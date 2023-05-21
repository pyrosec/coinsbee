"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CoinsbeeClient = void 0;
const _2captcha_1 = require("2captcha");
const cheerio_1 = __importDefault(require("cheerio"));
const url_1 = __importDefault(require("url"));
const querystring_1 = __importDefault(require("querystring"));
const base_puppeteer_1 = require("base-puppeteer");
const vm_1 = __importDefault(require("vm"));
const ethers_1 = require("ethers");
const string_entropy_1 = __importDefault(require("string-entropy"));
const DEFAULT_ENTROPY = 70;
const solver = process.env.TWOCAPTCHA_API_KEY ? new _2captcha_1.Solver(process.env.TWOCAPTCHA_API_KEY) : null;
const serializeProducts = (list) => list.map((v) => v.href).join("|");
const findDollarAmount = (ary) => ((ary.find((v) => v.match(/\$/)) || "").match(/(?:(\$[\d\.]+))/g) || [])[0] ||
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
    const $ = cheerio_1.default.load(htmlContent);
    const payment = JSON.parse($('textarea#__payment').text());
    const script = $('script').text();
    const context = vm_1.default.createContext();
    context.window = {};
    vm_1.default.runInContext(script, context);
    const config = context.window.__APP_CONFIG__;
    return {
        config,
        payment
    };
};
const tableToShoppingCart = (table) => {
    const $ = cheerio_1.default.load(table);
    const items = [];
    $("div.cart-item").each(function () {
        const href = $(this).find("a").attr("href").trim();
        const name = $(this).find("h4").text().trim();
        const region = $(this).find("span#region").text().trim();
        const price = findDollarAmount($(this)
            .find(".price-prop")
            .text()
            .trim()
            .split(/\s/)
            .map((v) => v.trim())
            .filter(Boolean));
        items.push({ href, name, region, price });
    });
    const total = findDollarAmount($("div.px-sm-4.mb-4:not(.py-sm-4) div.price-prop span")
        .text()
        .trim()
        .split(/\s/)
        .map((v) => v.trim()));
    return { items, total };
};
class CoinsbeeClient extends base_puppeteer_1.BasePuppeteer {
    async shoppingCart() {
        return await this._call(url_1.default.format({
            protocol: 'https:',
            hostname: 'www.coinsbee.com',
            pathname: '/en/shoppingcart'
        }), {
            method: 'GET'
        });
    }
    async getListingPage({ offset = 0, cat = "all", region = "US", search = "", }) {
        const uri = url_1.default.format({
            hostname: "www.coinsbee.com",
            pathname: "/en/modules/shop_processing.php",
            protocol: "https:",
            search: "?" + querystring_1.default.stringify({ offset, cat, region, search }),
        });
        const { brands } = await (await this._call(uri, { method: "POST" })).json();
        const $ = cheerio_1.default.load(brands);
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
                href: url_1.default.format({
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
        const $ = cheerio_1.default.load(text);
        const metadata = JSON.parse($('script[type="application/ld+json"]').text().trim());
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
        return await (await this._call(url_1.default.format({
            protocol: "https:",
            hostname: "www.coinsbee.com",
            pathname: "/en/modules/brand_addtocart.php",
            search: "?" + querystring_1.default.stringify({ id, q }),
        }), {
            method: "POST",
        })).json();
    }
    async getShoppingCart({ method = "refresh", id = null, q = "0" }) {
        await this.homepage();
        const data = await (await this._call(url_1.default.format({
            protocol: "https:",
            hostname: "www.coinsbee.com",
            pathname: "/en/modules/shoppingcart_processing.php",
            search: querystring_1.default.stringify({ method, id, q }),
        }), {
            method: "POST",
        })).json();
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
        for (let i = 0;; i += 24) {
            const toAdd = await this.getListingPage({
                cat,
                region,
                search,
                offset: i,
            });
            const serialized = serializeProducts(toAdd);
            if (!toAdd.length || lastSerialized === serialized)
                return result;
            lastSerialized = serialized;
            result = result.concat(toAdd);
        }
    }
    constructor(o) {
        super(o);
        this.auth = o.auth || null;
    }
    async checkout({ pay, coin = 'ETH' }) {
        await this.goto({ url: url_1.default.format({ protocol: 'https:', hostname: 'www.coinsbee.com', pathname: '/en/checkout' }) });
        await this.waitForSelector({ selector: 'button#btnBuyCoingate' });
        await this.click({ selector: 'button#btnBuyCoingate' });
        await this.waitForSelector({ selector: 'div.method-body' });
        await this._page.evaluate((coin) => [].slice.call(document.querySelectorAll('li.check-item')).find((v) => v.innerText === coin).click(), coin);
        await this._page.evaluate(() => document.evaluate("//span[contains(text(), 'View Address')]", document, null, XPathResult.ANY_TYPE, null).iterateNext().click());
        await this.waitForSelector({ selector: 'div.payment-amount span.amount' });
        const response = await this._page.evaluate(() => {
            const el = document.querySelector('div.payment-amount');
            return {
                coin: el.querySelector('span.exp-coin-name-main').innerText.trim(),
                amount: el.querySelector('span.amount').innerText.trim(),
                address: document.querySelector('div.view-address-wrapper div.infos div.info-item-content span').innerText
            };
        });
        if (pay) {
            if (!process.env.WALLET)
                throw Error('must set WALLET');
            if (response.coin !== 'ETH')
                throw Error('this CLI only supports ETH payments');
            const wallet = new ethers_1.ethers.Wallet(process.env.WALLET).connect(new ethers_1.ethers.InfuraProvider(process.env.INFURA_PROJECT_ID));
            const tx = await wallet.sendTransaction({
                to: response.address,
                value: ethers_1.ethers.parseEther(response.amount)
            });
            this.logger.info('https://etherscan.io/address/' + tx.hash);
            return tx;
        }
        return response;
    }
    async checkoutProcessing({ currency = "ETH", nw = "2", pm = "Crypto", discountcode = "", }) {
        const data = await (await this._call(url_1.default.format({
            hostname: "www.coinsbee.com",
            protocol: "https:",
            pathname: "/en/modules/checkout_processing.php",
            search: "?" + querystring_1.default.stringify({ currency, nw, pm, discountcode }),
        }), {
            method: "POST",
        })).json();
        const { table, coins, networks } = data;
        const $coins = cheerio_1.default.load(coins);
        const $networks = cheerio_1.default.load(networks);
        data.coins = optionsToList($coins, $coins("option"));
        data.networks = optionsToList($networks, $networks("option"));
        data.cart = tableToShoppingCart(table);
        delete data.table;
        return data;
    }
    async _call(uri, config = {}) {
        config.redirect = config.redirect || "follow";
        config.headers = config.headers || {};
        this.logger.info(((config.method && config.method + "|") || "GET|") + uri);
        const response = await this._page.evaluate(async (uri, config) => {
            const response = await window.fetch(uri, config);
            const result = {
                _content: await response.text(),
                headers: [...response.headers],
                status: response.status
            };
            return result;
        }, uri, config);
        response.json = function () { return JSON.parse(this._content); };
        response.text = function () { return this._content; };
        this.logger.info("status|" + response.status);
        return response;
    }
    async userOrders({ from, length = "100" }) {
        const query = {};
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
        query._ = String(!from ? (Date.now() - 1000 * 60 * 60 * 24 * 30) : !isNaN(from) ? from : +new Date(from));
        const response = await (await this._call(url_1.default.format({
            hostname: 'www.coinsbee.com',
            protocol: 'https:',
            pathname: '/en/modules/user_orders_processing.php',
            search: '?' + querystring_1.default.stringify(query)
        }), {
            method: "POST"
        })).json();
        const { data } = response;
        delete response.data;
        return {
            ...response,
            data: data.map(([date, cost, currency, status, markup]) => {
                const $ = cheerio_1.default.load(markup);
                const [orderid, hash] = $('a').eq(0).attr('href').split('&').slice(-2).map((v) => v.split('=').slice(1).join('='));
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
        const { data } = await this.userOrders({});
        const { orderid, hash } = data[0];
        return { orderid, hash };
    }
    async _processPoll(tick, entropy = DEFAULT_ENTROPY) {
        const { product, pin, code, url } = tick;
        if (url) {
            return Object.assign({}, tick, {
                retrieved: await this.retrieveCodeFromUrl({ url, entropy })
            });
        }
        if (pin || code)
            return tick;
        return null;
    }
    async poll({ entropy = DEFAULT_ENTROPY }) {
        const lastOrder = await this.lastOrder();
        while (true) {
            const tick = await this.userOrdersDetails(lastOrder);
            const processed = await this._processPoll(tick, entropy);
            if (processed)
                return processed;
            await this.timeout({ n: 1000 });
        }
    }
    async retrieveCodeFromUrl({ url, entropy }) {
        const content = await (await this._call(url, {
            method: "GET"
        })).text();
        const tokens = cheerio_1.default.load(content)('body').text().split(/[\s\n]+/).filter(Boolean);
        return tokens.filter((v) => /^[a-zA-Z0-9\-]+$/.test(v) && v.length < 32 && (0, string_entropy_1.default)(v) > entropy);
    }
    async userOrdersDetails({ orderid, hash }) {
        await this.homepage();
        const response = await this._call(url_1.default.format({
            protocol: 'https:',
            hostname: 'www.coinsbee.com',
            pathname: '/en/user_orders_details&orderid=' + orderid + '&hash=' + hash
        }), {
            method: 'GET'
        });
        const $ = cheerio_1.default.load(await response.text());
        const cells = [];
        $('tbody td').each(function () {
            cells.push($(this).find('a').attr('href') || $(this).text().trim());
        });
        const [product, code, pin, urlCell] = cells;
        return {
            product,
            pin,
            code,
            url: urlCell
        };
    }
    async checkoutProceed({ discountcode = "", terms = "", coin = "ETH", network = 2, btnBuyCoinGate = "", cpf = "", fullname = "" }) {
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
        if (!location)
            return response;
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
        if (!solver)
            throw Error('must set TWOCAPTCHA_API_KEY');
        this.auth = this.auth || {};
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
    async solveCaptcha(pageContent) {
        const $ = cheerio_1.default.load(pageContent);
        const data = $(".form-text img").attr("src");
        this.logger.info("solving captcha");
        const c = (await solver.imageCaptcha(data.substr(23))).data;
        this.logger.info("captcha:" + c);
        return c;
    }
    async signup({ email, password, firstname, lastname, street, postcode, city, country, birthday, }) {
        if (!solver)
            throw Error('must set TWOCAPTCHA_API_KEY');
        this.logger.info("signup|" + email);
        const response = await this.getSignupPage();
        await this.goto({ url: 'https://www.coinsbee.com/en/signup' });
        await this.waitForSelector({ selector: 'input#email' });
        const c = await this.solveCaptcha(await this._page.content());
        await this._page.evaluate(({ email, password, firstname, lastname, street, postcode, city, country, birthday, c }) => {
            const append = (name, value) => document.querySelector('input[name="' + name + '"]').value = value;
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
            document.querySelector('input#terms').checked = true;
        }, { email, password, firstname, lastname, street, postcode, city, country, birthday, c });
        await this.click({ selector: 'button[type="submit"]' });
        await this.timeout({ n: 1000 });
        return { success: true };
    }
}
exports.CoinsbeeClient = CoinsbeeClient;
//# sourceMappingURL=coinsbee.js.map