import makeFetchCookie from "fetch-cookie";
import url, { URL } from "url";
import qs from "querystring";
import UserAgent from 'user-agents';

const CookieJar = (makeFetchCookie as any).toughCookie.CookieJar;

export class GuerrillaSession {
  public jar: any;
  public ip: any;
  public userAgent: any;
  public email_addr: string;
  constructor() {
    this.jar = new CookieJar();
    this.ip = null;
    this.userAgent = new UserAgent().toString();
  }
  async _fetch(method, config = ({} as any)) {
    const fetchCookie = makeFetchCookie(fetch, this.jar);
    config.headers = config.headers || {};
    config.headers['user-agent'] = this.userAgent;
    return await fetchCookie(method, config);
  }
  async checkIp() {
    const { ip } = await (await fetch('https://api64.ipify.org/json', { method: 'GET' })).json();
    this.ip = ip;
    return ip;
  }
 
  async _call(methodName, data) {
     return await this._fetch(url.format({ protocol: 'https:', hostname: 'api.guerrillamail.com', pathname: 'ajax.php', search: '?' + qs.stringify({ f: methodName, ip: this.ip, })}), { method: 'POST', body: qs.stringify(data) });
  }

  async createGuerillaMailAccount() {
     const response = await this._call('get_email_address', {});
     const { email_addr } = await response.json();
     this.email_addr = email_addr;
     return email_addr;
  }

  async checkMailForVerificationLink() {
    const response = await this._call('check_email', {});
    const jsonResponse = await response.json();
    console.log("check_email api response: ", jsonResponse);
    const { list } = jsonResponse;
    console.log("checking mail: ", list);
    const verificationEmail = list.find((email: any) => email.mail_subject === "Signup - coinsbee.com");
  
    if (verificationEmail) {
      const regex = /https:\/\/www\.coinsbee\.com\/en\/signup&id=\d+&hash=[a-zA-Z0-9]+/;
      const verificationLink = verificationEmail.mail_body.match(regex);
  
      if (verificationLink) {
        return verificationLink[0];
      }
    }
  
    return null; 
  }
}
