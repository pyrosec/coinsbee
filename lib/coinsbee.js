"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CoinsbeeClient = void 0;
const node_fetch_1 = __importDefault(require("node-fetch"));
const fetch_cookie_1 = __importDefault(require("fetch-cookie"));
const socks_proxy_agent_1 = require("socks-proxy-agent");
const https_proxy_agent_1 = __importDefault(require("https-proxy-agent"));
const _2captcha_1 = require("2captcha");
const cheerio_1 = __importDefault(require("cheerio"));
const https_1 = __importDefault(require("https"));
const user_agents_1 = __importDefault(require("user-agents"));
const logger_1 = require("./logger");
const solver = new _2captcha_1.Solver(process.env.TWOCAPTCHA_API_KEY);
const CookieJarClass = fetch_cookie_1.default.toughCookie.CookieJar;
class CoinsbeeClient {
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
    constructor({ logger, jar, userAgent, auth, insecure = false }) {
        this.userAgent = userAgent || new user_agents_1.default().toString();
        this.jar =
            (jar &&
                fetch_cookie_1.default.toughCookie.CookieJar.deserializeSync(jar)) ||
                new fetch_cookie_1.default.toughCookie.CookieJar();
        this.insecure = insecure;
        this.logger = logger || (0, logger_1.getLogger)();
        this.auth = auth || null;
    }
    async _call(uri, config = {}) {
        const fetchCookie = (0, fetch_cookie_1.default)(node_fetch_1.default, this.jar);
        config.agent = this._makeAgent();
        config.redirect = config.redirect || 'follow';
        //    config.referer = 'client';
        config.headers = Object.assign({
            'user-agent': this.userAgent,
            'accept-language': 'en-US,en;q=0.9',
            'accept-encoding': 'gzip, deflate, br',
            accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7'
        }, config.headers || {});
        this.logger.info(config.method || 'GET|' + uri);
        const response = await fetchCookie(uri, config);
        this.logger.info('status|' + response.status);
        return response;
    }
    static fromObject(o) {
        return new CoinsbeeClient(o);
    }
    static fromJSON(s) {
        return this.fromObject(JSON.parse(s));
    }
    toObject() {
        return {
            userAgent: this.userAgent,
            jar: this.jar.serializeSync(),
            auth: this.auth
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
            method: "GET"
        });
    }
    async getSignupPage() {
        const response = await this._call("https://www.coinsbee.com/en/signup", {
            method: "GET",
            redirect: "manual"
        });
        return this.rewriteAndFollowRedirect(response);
    }
    async login({ email, password }) {
        this.auth = this.auth || {};
        this.auth.email = email || this.auth.email;
        this.auth.password = password || this.auth.password;
        const response = await this._call("https://www.coinsbee.com/en/login", {
            method: "GET"
        });
        const c = await this.solveCaptcha(await response.text());
        const formData = new URLSearchParams();
        formData.append("email", this.auth.email);
        formData.append("password", this.auth.password);
        formData.append("c", c);
        return await this._call("https://www.coinsbee.com/en/login", {
            method: "POST",
            body: formData,
            redirect: "manual",
            headers: {
                "content-type": "application/x-www-form-urlencoded",
            },
        });
    }
    async solveCaptcha(pageContent) {
        const $ = cheerio_1.default.load(pageContent);
        const data = $(".form-text img").attr("src");
        this.logger.info('solving captcha');
        const c = (await solver.imageCaptcha(data.substr(23))).data;
        this.logger.info('captcha:' + c);
        return c;
    }
    async signup({ email, password, firstname, lastname, street, postcode, city, country, birthday, }) {
        this.logger.info('signup|' + email);
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
        return await (await this._call("https://www.coinsbee.com/en/signup", {
            method: "POST",
            body: formData,
            redirect: "manual",
            headers: {
                "content-type": "application/x-www-form-urlencoded",
            },
        }));
    }
}
exports.CoinsbeeClient = CoinsbeeClient;
//# sourceMappingURL=coinsbee.js.map