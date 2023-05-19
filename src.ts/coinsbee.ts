import fetch from "node-fetch";
import makeFetchCookie from "fetch-cookie";
import { SocksProxyAgent } from "socks-proxy-agent";
import HttpsProxyAgent from "https-proxy-agent";
import { Solver } from "2captcha";
import cheerio from "cheerio";
import url, { URL } from "url";
import https from "https";
import UserAgent from "user-agents";

const solver = new Solver(process.env.TWOCAPTCHA_API_KEY);

const CookieJarClass = (makeFetchCookie.toughCookie as any).CookieJar;

type CookieJar = typeof CookieJarClass;

export class CoinsbeeClient {
  public jar: CookieJar;
  public proxyOptions: any;
  public insecure: boolean;
  public userAgent: string;
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
  constructor({ jar, userAgent, insecure = false }: any) {
    this.userAgent = userAgent || new UserAgent().toString();
    this.jar =
      (jar &&
        (makeFetchCookie.toughCookie as any).CookieJar.deserializeSync(jar)) ||
      new (makeFetchCookie.toughCookie as any).CookieJar();
    this.insecure = insecure;
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
    return await fetchCookie(uri, config);
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
    const response: any = await this.getSignupPage();
    const text = await response.text();
    const $ = cheerio.load(text);
    const data = $(".form-text img").attr("src");
    const c = (await solver.imageCaptcha(data.substr(23))).data;
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
