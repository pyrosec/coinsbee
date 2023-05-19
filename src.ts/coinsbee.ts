import fetch from "node-fetch";
import makeFetchCookie from "fetch-cookie";
import { SocksProxyAgent } from "socks-proxy-agent";
import HttpsProxyAgent from "https-proxy-agent";
import { Solver } from "2captcha";
import cheerio from "cheerio";
import url, { URL } from "url";
import https from "https";
import UserAgent from "user-agents";
import { getLogger } from "./logger";

const solver = new Solver(process.env.TWOCAPTCHA_API_KEY);

const CookieJarClass = (makeFetchCookie.toughCookie as any).CookieJar;

type CookieJar = typeof CookieJarClass;

interface ISavedAuthentication {
  email: string;
  password: string;
}

export class CoinsbeeClient {
  public logger: ReturnType<typeof getLogger>;
  public jar: CookieJar;
  public proxyOptions: any;
  public insecure: boolean;
  public userAgent: string;
  public auth: null | ISavedAuthentication;
  static async initialize(o: any) {
    return new CoinsbeeClient(o);
  }
  _makeAgent() {
    const proxyOptions = this.proxyOptions || null;
    if (!proxyOptions) {
      if (!this.insecure) return null;
      return new https.Agent({ rejectUnauthorized: !this.insecure });
    }
    if (proxyOptions.type === "socks") {
      const opts = {
        ...proxyOptions,
      };
      delete opts.type;
      return new SocksProxyAgent(opts);
    } else if (proxyOptions.type === "http" || this.insecure) {
      const proxyParams = {
        host: proxyOptions.hostname,
        port: proxyOptions.port,
        auth:
          (proxyOptions.userId &&
            proxyOptions.password &&
            proxyOptions.userId + ":" + proxyOptions.password) ||
          null,
      };
      return new HttpsProxyAgent({
        ...proxyParams,
	secure: true,
	https: true,
        rejectUnauthorized: !this.insecure,
      });
    } else return null;
  }
  constructor({ logger, jar, userAgent, auth, insecure = false }: any) {
    this.userAgent = userAgent || new UserAgent().toString();
    this.jar =
      (jar &&
        (makeFetchCookie.toughCookie as any).CookieJar.deserializeSync(jar)) ||
      new (makeFetchCookie.toughCookie as any).CookieJar();
    this.insecure = insecure;
    this.logger = logger || getLogger();
    this.auth = auth || null;
  }
  async _call(uri, config: any = {}) {
    const fetchCookie: any = makeFetchCookie(fetch, this.jar);
    config.agent = this._makeAgent();
    config.redirect = config.redirect || 'follow';
//    config.referer = 'client';
    config.headers = Object.assign({
      'user-agent': this.userAgent,
      'accept-language': 'en-US,en;q=0.9',
      'accept-encoding': 'gzip, deflate, br',
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7'
    }, config.headers || {});
    this.logger.info((config.method || 'GET|') + uri);
    const response = await fetchCookie(uri, config);
    this.logger.info('status|' + response.status);
    return response;
  }
  static fromObject(o: any) {
    return new CoinsbeeClient(o);
  }
  static fromJSON(s: string) {
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
    const location = Object.fromEntries([ ...response.headers ]).location;
    if (!location) return response;
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
  async login({
    email,
    password
  }) {
    this.auth = this.auth || ({} as ISavedAuthentication);
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
  async solveCaptcha(pageContent: string) {
    const $ = cheerio.load(pageContent);
    const data = $(".form-text img").attr("src");
    this.logger.info('solving captcha');
    const c = (await solver.imageCaptcha(data.substr(23))).data;
    this.logger.info('captcha:' + c);
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
    this.logger.info('signup|' + email);
    const response: any = await this.getSignupPage();
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
    return await (
      await this._call("https://www.coinsbee.com/en/signup", {
        method: "POST",
        body: formData,
        redirect: "manual",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
        },
      })
    );
  }
}
