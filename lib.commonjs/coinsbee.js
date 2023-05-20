"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CoinsbeeClient = void 0;
const socks_proxy_agent_1 = require("socks-proxy-agent");
const https_proxy_agent_1 = __importDefault(require("https-proxy-agent"));
const _2captcha_1 = require("2captcha");
const cheerio_1 = __importDefault(require("cheerio"));
const url_1 = __importDefault(require("url"));
const https_1 = __importDefault(require("https"));
const user_agents_1 = __importDefault(require("user-agents"));
const querystring_1 = __importDefault(require("querystring"));
const logger_js_1 = require("./logger.js");
const vm_1 = __importDefault(require("vm"));
const fetch_h2_1 = require("fetch-h2");
const deserializeSync = (s) => Object.assign(new fetch_h2_1.CookieJar(), { _jar: new fetch_h2_1.CookieJar()._jar.constructor.deserializeSync(s) });
const serializeSync = (jar) => jar._jar.serializeSync();
const ln = (v) => ((console.log(v)), v);
/*
const headersSet = Headers.prototype.set;
const headersHas = Headers.prototype.has;

Headers.prototype.set = function (...args) {
  const [ key, ...rest ] = args;
  return headersSet.call(this, key.toLowerCase(), ...rest);
};

Headers.prototype.has = function (...args) {
  const [ key ] = args;
  if (key === 'Connection') return true;
  return headersHas.call(this, ...args);
};
*/
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
class CoinsbeeClient {
    logger;
    jar;
    proxyOptions;
    insecure;
    userAgent;
    auth;
    static async initialize(o) {
        return new CoinsbeeClient(o);
    }
    _makeAgent() {
        const proxyOptions = this.proxyOptions || null;
        if (!proxyOptions) {
            if (!this.insecure)
                return null;
            return new https_1.default.Agent({ rejectUnauthorized: !this.insecure });
        }
        if (proxyOptions.type === "socks") {
            const opts = {
                ...proxyOptions,
            };
            delete opts.type;
            return new socks_proxy_agent_1.SocksProxyAgent(opts);
        }
        else if (proxyOptions.type === "http" || this.insecure) {
            const proxyParams = {
                host: proxyOptions.hostname,
                port: proxyOptions.port,
                auth: (proxyOptions.userId &&
                    proxyOptions.password &&
                    proxyOptions.userId + ":" + proxyOptions.password) ||
                    null,
            };
            return new https_proxy_agent_1.default({
                ...proxyParams,
                secure: true,
                https: true,
                rejectUnauthorized: !this.insecure,
            });
        }
        else
            return null;
    }
    async shoppingCart() {
        return await this._call(url_1.default.format({
            protocol: 'http2:',
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
    async loadProduct({ name, search }) {
        search = search || name;
        const response = await this._call(await this._getHref({ name, search }), {
            method: "GET",
        });
        const text = await response.text();
        return this._getProductData({ text });
    }
    async addToCart({ id, q = "1" }) {
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
    constructor({ logger, jar, userAgent, auth, insecure = false }) {
        this.userAgent = userAgent || new user_agents_1.default().toString();
        this.jar = (jar && deserializeSync(jar)) || new fetch_h2_1.CookieJar();
        this.insecure = insecure;
        this.logger = logger || (0, logger_js_1.getLogger)();
        this.auth = auth || null;
    }
    async checkout() {
        return await this._call(url_1.default.format({
            protocol: 'http2:',
            hostname: 'www.coinsbee.com',
            pathname: '/en/checkout'
        }), {
            method: 'POST'
        });
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
        const cloned = { ...config };
        config.redirect = config.redirect || 'follow';
        const { fetch } = (0, fetch_h2_1.context)({ cookieJar: this.jar, userAgent: this.userAgent });
        cloned.agent = this._makeAgent();
        const { redirect } = cloned;
        cloned.redirect = config.method === 'POST' && "manual" || config.redirect;
        cloned.compress = cloned.compress == null ? true : cloned.compress;
        //    config.referer = 'client';
        cloned.headers = Object.assign({
            "accept-language": "en-US,en;q=0.9",
            accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        }, cloned.headers || {});
        this.logger.info(((cloned.method && cloned.method + "|") || "GET|") + uri);
        const response = await fetch(uri, cloned);
        this.logger.info("status|" + response.status);
        if (config.redirect === 'follow' && [301, 302].includes(response.status) && config.method === 'POST') {
            const headers = [...response.headers];
            const location = headers.find(([key, value]) => key.toLowerCase() === 'location')[1];
            if (location) {
                const parsed = url_1.default.parse(location);
                const formatted = url_1.default.format({ ...parsed, protocol: 'http2:' });
                return await this._call(formatted, {
                    method: 'GET',
                    redirect: 'follow'
                });
            }
        }
        return response;
    }
    static fromObject(o) {
        return new CoinsbeeClient(o);
    }
    static fromJSON(s) {
        return this.fromObject(JSON.parse(s));
    }
    async userOrders({ from, length = "100" }) {
        const query = {};
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
            protocol: 'http2:',
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
    async userOrdersDetails({ orderid, hash }) {
        const response = await this._call(url_1.default.format({
            protocol: 'http2:',
            hostname: 'www.coinsbee.com',
            pathname: '/en/user_orders_details&orderid=' + orderid + '&hash=' + hash
        }), {
            method: 'GET'
        });
        const $ = cheerio_1.default.load(await response.text());
        const cells = [];
        $('tbody td').each(function () {
            cells.push($(this).text().trim());
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
        const response = await this._call(url_1.default.format({
            hostname: 'www.coinsbee.com',
            pathname: '/modules/checkout_proceed.php',
            protocol: 'http2:'
        }), {
            method: 'POST',
            body: formData.toString(),
            redirect: 'manual',
            referrer: 'https://www.coinsbee.com/en/checkout',
            headers: {
                //  'upgrade-insecure-requests': 1,
                'content-type': 'application/x-www-form-urlencoded',
                accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'accept-language': 'en-US,en;q=0.9'
            }
        });
        return [...response.headers];
        const htmlContent = await response.text();
        return mixpayPageToObject(htmlContent);
    }
    toObject() {
        return {
            userAgent: this.userAgent,
            jar: serializeSync(this.jar),
            auth: this.auth,
        };
    }
    toJSON() {
        return JSON.stringify(this.toObject(), null, 2);
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
        const response = await this._call("http2://www.coinsbee.com/en/login&return=", {
            method: "GET",
        });
        const c = await this.solveCaptcha(await response.text());
        const formData = new URLSearchParams();
        formData.append("email", this.auth.email);
        formData.append("password", this.auth.password);
        formData.append("c", c);
        return await this._call("http2://www.coinsbee.com/en/login&return=", {
            method: "POST",
            body: formData.toString(),
            redirect: "follow",
            headers: {
                "content-type": "application/x-www-form-urlencoded",
            },
        });
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
        const c = await this.solveCaptcha(await response.text());
        const formData = new URLSearchParams();
        formData.append("email", email);
        formData.append("password1", password);
        formData.append("password2", password);
        formData.append("firstname", firstname);
        formData.append("lastname", lastname);
        formData.append("street", street);
        formData.append("postcode", postcode);
        formData.append("city", city);
        formData.append("country", country);
        formData.append("birthday", birthday);
        formData.append("terms", "");
        formData.append("c", c);
        return await await this._call("http2://www.coinsbee.com/en/signup", {
            method: "POST",
            body: formData.toString(),
            redirect: "manual",
            headers: {
                "content-type": "application/x-www-form-urlencoded",
            },
        });
    }
}
exports.CoinsbeeClient = CoinsbeeClient;
//# sourceMappingURL=coinsbee.js.map