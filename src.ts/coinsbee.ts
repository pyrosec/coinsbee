import { Solver } from "2captcha";
import cheerio from "cheerio";
import url, { URL } from "url";
import qs from "querystring";
import { getLogger } from "./logger.js";
import { BasePuppeteer } from "base-puppeteer";
import vm from "vm";
import { ethers } from "ethers";
import stringEntropy from "string-entropy";

const DEFAULT_ENTROPY = 70;

const solver = process.env.TWOCAPTCHA_API_KEY ? new Solver(process.env.TWOCAPTCHA_API_KEY) : null;

const serializeProducts = (list) => list.map((v) => v.href).join("|");

interface ISavedAuthentication {
  email: string;
  password: string;
}

const findDollarAmount = (ary) =>
  ((ary.find((v) => v.match(/\$/)) || "").match(/(?:(\$[\d\.]+))/g) || [])[0] ||
  null;

const optionsToList = ($, el) => {
  const results = [];
  el.each(function () {
    results.push({
      name: $(this).text().trim(),
      value: $(this).attr("value"),
    });
  });
  return results;
};

const mixpayPageToObject = (htmlContent) => {
  const $ = cheerio.load(htmlContent);
  const payment = JSON.parse($('textarea#__payment').text());
  const script = $('script').text();
  const context = vm.createContext();
  context.window = {};
  vm.runInContext(script, context);
  const config = context.window.__APP_CONFIG__;
  return {
    config,
    payment
  };
};

const tableToShoppingCart = (table) => {
  const $ = cheerio.load(table);
  const items = [];
  $("div.cart-item").each(function () {
    const href = $(this).find("a").attr("href").trim();
    const name = $(this).find("h4").text().trim();
    const region = $(this).find("span#region").text().trim();
    const price = findDollarAmount(
      $(this)
        .find(".price-prop")
        .text()
        .trim()
        .split(/\s/)
        .map((v) => v.trim())
        .filter(Boolean)
    );
    items.push({ href, name, region, price });
  });
  const total = findDollarAmount(
    $("div.px-sm-4.mb-4:not(.py-sm-4) div.price-prop span")
      .text()
      .trim()
      .split(/\s/)
      .map((v) => v.trim())
  );
  return { items, total };
};

export class CoinsbeeClient extends BasePuppeteer {
  public auth: null | ISavedAuthentication;
  async shoppingCart() {
    return await this._call(url.format({
      protocol: 'https:',
      hostname: 'www.coinsbee.com',
      pathname: '/en/shoppingcart'
    }), {
      method: 'GET'
    });
  }
  async getListingPage({
    offset = 0,
    cat = "all",
    region = "US",
    search = "",
  }) {
    const uri = url.format({
      hostname: "www.coinsbee.com",
      pathname: "/en/modules/shop_processing.php",
      protocol: "https:",
      search: "?" + qs.stringify({ offset, cat, region, search }),
    });
    const { brands } = await (await this._call(uri, { method: "POST" })).json();
    const $ = cheerio.load(brands);
    const result = [];
    $("a").each(function () {
      let [name, category] = $(this)
        .text()
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((v) => v.trim())
        .filter(Boolean);
      let inStock = true;
      if (name === "out of stock") {
        name = category;
        category = "N/A";
        inStock = false;
      }
      result.push({
        name,
        inStock,
        category,
        href: url.format({
          protocol: "https:",
          hostname: "www.coinsbee.com",
          pathname: $(this).attr("href"),
        }),
      });
    });
    return result;
  }
  async _getHref({ name, search }) {
    this.logger.info("getting listings");
    const listings = await this.getProducts({ search });
    return listings.find((v) => v.name === name).href;
  }
  _getProductData({ text }) {
    const $ = cheerio.load(text);
    const metadata = JSON.parse(
      $('script[type="application/ld+json"]').text().trim()
    );
    const el = $("select#product");
    const brandId = el.attr("onchange").match(/\d+/g)[0];
    const products = optionsToList($, el.find("option"));
    const currencies = optionsToList($, $("select#currency option"));
    return {
      currencies,
      products,
      brandId,
      metadata,
    };
  }
  async homepage() {
    await this.goto({ url: 'https://www.coinsbee.com' });
  }
  async loadProduct({ name, search }) {
    search = search || name;
    const response = await this._call(await this._getHref({ name, search }), {
      method: "GET",
    });
    const text = await response.text();
    return this._getProductData({ text });
  }
  async addToCart({ id, q = "1" }) {
    await this.homepage();
    return await (
      await this._call(
        url.format({
          protocol: "https:",
          hostname: "www.coinsbee.com",
          pathname: "/en/modules/brand_addtocart.php",
          search: "?" + qs.stringify({ id, q }),
        }),
        {
          method: "POST",
        }
      )
    ).json();
  }
  async getShoppingCart({ method = "refresh", id = null, q = "0" }) {
    await this.homepage();
    const data = await (
      await this._call(
        url.format({
          protocol: "https:",
          hostname: "www.coinsbee.com",
          pathname: "/en/modules/shoppingcart_processing.php",
          search: qs.stringify({ method, id, q }),
        }),
        {
          method: "POST",
        }
      )
    ).json();
    const { table } = data;
    delete data.table;
    const { items, total } = tableToShoppingCart(table);
    return {
      items,
      total,
      ...data,
    };
  }
  async getProducts({ cat = "all", region = "US", search = "" }) {
    let result = [];
    let lastSerialized = null;
    for (let i = 0; ; i += 24) {
      const toAdd = await this.getListingPage({
        cat,
        region,
        search,
        offset: i,
      });
      const serialized = serializeProducts(toAdd);
      if (!toAdd.length || lastSerialized === serialized) return result;
      lastSerialized = serialized;
      result = result.concat(toAdd);
    }
  }
  constructor(o: any) {
    super(o)
    this.auth = o.auth || null;
  }
  async checkout({ pay, coin = 'ETH' }) {
    await this.goto({ url: url.format({ protocol: 'https:', hostname: 'www.coinsbee.com', pathname: '/en/checkout' }) });
    await this.waitForSelector({ selector: 'button#btnBuyCoingate' });
    await this.click({ selector: 'button#btnBuyCoingate' });
    await this.waitForSelector({ selector: 'div.method-body' });
    await this._page.evaluate((coin) => [].slice.call((document as any).querySelectorAll('li.check-item')).find((v) => v.innerText === coin).click(), coin);
    await this._page.evaluate(() => (document as any).evaluate("//span[contains(text(), 'View Address')]", document, null, XPathResult.ANY_TYPE, null).iterateNext().click());
    await this.waitForSelector({ selector: 'div.payment-amount span.amount' });
    const response = await this._page.evaluate(() => {
      const el = (document as any).querySelector('div.payment-amount');
      return {
        coin: el.querySelector('span.exp-coin-name-main').innerText.trim(),
        amount: el.querySelector('span.amount').innerText.trim(),
	address: (document as any).querySelector('div.view-address-wrapper div.infos div.info-item-content span').innerText
      };
    });
    if (pay) {
      if (!process.env.WALLET) throw Error('must set WALLET');
      if (response.coin !== 'ETH') throw Error('this CLI only supports ETH payments');
      const wallet = new ethers.Wallet(process.env.WALLET).connect(new ethers.InfuraProvider(process.env.INFURA_PROJECT_ID));
      const tx = await wallet.sendTransaction({
        to: response.address,
        value: ethers.parseEther(response.amount)
      });
      this.logger.info('https://etherscan.io/address/' + tx.hash);
      return tx;
    }
    return response;
  }
  async checkoutProcessing({
    currency = "ETH",
    nw = "2",
    pm = "Crypto",
    discountcode = "",
  }) {
    const data = await (
      await this._call(
        url.format({
          hostname: "www.coinsbee.com",
          protocol: "https:",
          pathname: "/en/modules/checkout_processing.php",
          search: "?" + qs.stringify({ currency, nw, pm, discountcode }),
        }),
        {
          method: "POST",
        }
      )
    ).json();
    const { table, coins, networks } = data;
    const $coins = cheerio.load(coins);
    const $networks = cheerio.load(networks);
    data.coins = optionsToList($coins, $coins("option"));
    data.networks = optionsToList($networks, $networks("option"));
    data.cart = tableToShoppingCart(table);
    delete data.table;
    return data;
  }
  async _call(uri, config: any = {}) {
    config.redirect = config.redirect || "follow";
    config.headers = config.headers || {};
    this.logger.info(((config.method && config.method + "|") || "GET|") + uri);
    const response = await this._page.evaluate(async (uri, config) => {
      const response = await window.fetch(uri, config);
      const result = {
        _content: await response.text(),
	headers: [ ...response.headers ],
	status: response.status
      };
      return result;
    }, uri, config);
    response.json = function () { return JSON.parse(this._content); };
    response.text = function () { return this._content; };
    this.logger.info("status|" + response.status);
    return response;
  }
  async userOrders({
    from,
    length = "100"
  }) {
    const query: any = {};
    await this.homepage();
    Array(4).fill(0).forEach((v, i) => {
      query['columns[' + i + '][data]'] = String(i);
      query['columns[' + i + '][name]'] = "";
      query['columns[' + i + '][searchable]'] = "true";
      query['columns[' + i + '][orderable]'] = "true";
      query['columns[' + i + '][search][value]'] = "";
      query['columns[' + i + '][search][regex]'] = "false";
    });
    query['order[0][column]'] = "0";
    query['order[0][dir]'] = "desc";
    query.start = "0";
    query.length = length; 
    query["search[value]"] = "";
    query["search[regex]"] = "false";
    query._ = String(!from ? (Date.now() - 1000*60*60*24*30) : !isNaN(from) ? from : +new Date(from));
    const response = await (await this._call(url.format({
      hostname: 'www.coinsbee.com',
      protocol: 'https:',
      pathname: '/en/modules/user_orders_processing.php',
      search: '?' + qs.stringify(query)
    }), {
      method: "POST"
    })).json();
    const { data } = response;
    delete response.data;
    return {
      ...response,
      data: data.map(([ date, cost, currency, status, markup ]) => {
        const $ = cheerio.load(markup);
	const [ orderid, hash ] = $('a').eq(0).attr('href').split('&').slice(-2).map((v) => v.split('=').slice(1).join('='));
	return {
          date,
	  cost,
	  currency,
	  status,
	  orderid,
	  hash
	};
      })
    };
  }
  async pollOne() {
    const tick = await this.userOrdersDetails(await this.lastOrder());
    return await this._processPoll(tick);
  }
  async lastOrder() {
    const { data } = await this.userOrders({} as any);
    const { orderid, hash } = data[0];
    return { orderid, hash };
  }
  async _processPoll(tick: any, entropy = DEFAULT_ENTROPY) {
    const { product, pin, code, url } = tick;
    if (url) {
      return Object.assign({}, tick, {
        retrieved: await this.retrieveCodeFromUrl({ url, entropy })
      });
    }
    if (pin || code) return tick;
    return null;
  }
  async poll({ entropy = DEFAULT_ENTROPY }) {
    const lastOrder = await this.lastOrder();
    while (true) {
      const tick = await this.userOrdersDetails(lastOrder);
      const processed = await this._processPoll(tick, entropy);
      if (processed) return processed;
      await this.timeout({ n: 1000 });
    }
  }
  async retrieveCodeFromUrl({
    url,
    entropy
  }) {
    const content = await (await this._call(url, {
      method: "GET"
    })).text();
    const tokens = cheerio.load(content)('body').text().split(/[\s\n]+/).filter(Boolean)
    return tokens.filter((v) => /^[a-zA-Z0-9\-]+$/.test(v) && v.length < 32 && stringEntropy(v) > entropy);
  }

  async userOrdersDetails({
    orderid,
    hash
  }) {
    await this.homepage();
    const response = await this._call(url.format({
      protocol: 'https:',
      hostname: 'www.coinsbee.com',
      pathname: '/en/user_orders_details&orderid=' + orderid + '&hash=' + hash
    }), {
      method: 'GET'
    });
    const $ = cheerio.load(await response.text());
    const cells = [];
    $('tbody td').each(function () {
      cells.push($(this).find('a').attr('href') || $(this).text().trim());
    });
    const [ product, code, pin, urlCell ] = cells;
    return {
      product,
      pin,
      code,
      url: urlCell
    };
  }
  async checkoutProceed({
    discountcode = "",
    terms = "",
    coin = "ETH",
    network = 2,
    btnBuyCoinGate = "",
    cpf = "",
    fullname = ""
  }) {
    const formData = new URLSearchParams();
    formData.append('discountcode', discountcode);
    formData.append('terms', terms);
    formData.append('coin', coin);
    formData.append('network', String(network));
    formData.append('btnBuyCoinGate', btnBuyCoinGate);
    formData.append('cpf', cpf);
    formData.append('fullname', fullname);
    const response = await this._call("https://www.coinsbee.com/modules/checkout_proceed.php", {
      method: 'POST',
      body: formData.toString(),
      redirect: 'manual',
      referrerPolicy: 'strict-origin-when-cross-origin',
      referrer: "https://www.coinsbee.com/en/checkout",
      compress: true,
      headers: {
        'upgrade-insecure-requests': 1,
        'content-type': 'application/x-www-form-urlencoded',
	accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
	'accept-language': 'en-US,en;q=0.9'
      }
    });
    return response;
    /*
    return [ ...response.headers ];
    const htmlContent = await response.text();
    return mixpayPageToObject(htmlContent);
   */
  }
  async rewriteAndFollowRedirect(response) {
    const location = Object.fromEntries([...response.headers]).location;
    if (!location) return response;
    return await this._call(location.replace("http://", "https://"), {
      method: "GET",
    });
  }

  async getSignupPage() {
    const response = await this._call("https://www.coinsbee.com/en/signup", {
      method: "GET",
      redirect: "manual",
    });
    return this.rewriteAndFollowRedirect(response);
  }
  async login({ email, password }) {
    if (!solver) throw Error('must set TWOCAPTCHA_API_KEY');
    this.auth = this.auth || ({} as ISavedAuthentication);
    this.auth.email = email || this.auth.email;
    this.auth.password = password || this.auth.password;
    await this.goto({ url: 'https://www.coinsbee.com/en/login' });
    await this.waitForSelector({ selector: 'input[type="email"]' });
    const text = await this._page.content();
    await this.type({ selector: 'input[type="email"]', value: email });
    await this.type({ selector: 'input[type="password"]', value: password });
    const c = await this.solveCaptcha(text);
    await this.type({ selector: 'input[type="text"][name="c"]', value: c });
    await this.click({ selector: 'button[type="submit"]' });
    await this.timeout({ n: 1000 });
    return { success: true };
  }
  async solveCaptcha(pageContent: string) {
    const $ = cheerio.load(pageContent);
    const data = $(".form-text img").attr("src");
    this.logger.info("solving captcha");
    const c = (await solver.imageCaptcha(data.substr(23))).data;
    this.logger.info("captcha:" + c);
    return c;
  }
  async signup({
    email,
    password,
    firstname,
    lastname,
    street,
    postcode,
    city,
    country,
    birthday,
  }) {
    if (!solver) throw Error('must set TWOCAPTCHA_API_KEY');
    this.logger.info("signup|" + email);
    const response: any = await this.getSignupPage();
    await this.goto({ url: 'https://www.coinsbee.com/en/signup' });
    await this.waitForSelector({ selector: 'input#email' });
    const c = await this.solveCaptcha(await this._page.content());
    await this._page.evaluate(({ email, password, firstname, lastname, street, postcode, city, country, birthday, c }) => {
      const append = (name, value) => (document as any).querySelector('input[name="' + name + '"]').value = value;
      append("email", email);
      append("password1", password);
      append("password2", password);
      append("firstname", firstname);
      append("lastname", lastname);
      append("street", street);
      append("postcode", postcode);
      append("city", city);
      append("country", country);
      append("birthday", birthday);
      append("terms", "");
      append("c", c);
      (document as any).querySelector('input#terms').checked = true;
    }, { email, password, firstname, lastname, street, postcode, city, country, birthday, c });
    await this.click({ selector: 'button[type="submit"]' });
    await this.timeout({ n: 1000 });
    return { success: true };
  }
}
