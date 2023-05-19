/// <reference types="node" />
import { SocksProxyAgent } from "socks-proxy-agent";
import https from "https";
declare const CookieJarClass: any;
type CookieJar = typeof CookieJarClass;
export declare class CoinsbeeClient {
    jar: CookieJar;
    proxyOptions: any;
    insecure: boolean;
    userAgent: string;
    static initialize(o: any): Promise<CoinsbeeClient>;
    _makeAgent(): https.Agent | SocksProxyAgent;
    constructor({ jar, userAgent, insecure }: any);
    _call(uri: any, config?: any): Promise<any>;
    static fromObject(o: any): CoinsbeeClient;
    static fromJSON(s: string): CoinsbeeClient;
    toObject(): {
        userAgent: string;
        jar: any;
    };
    toJSON(): string;
    rewriteAndFollowRedirect(response: any): Promise<any>;
    getSignupPage(): Promise<any>;
    signup({ email, password, firstname, lastname, street, postcode, city, country, birthday, }: {
        email: any;
        password: any;
        firstname: any;
        lastname: any;
        street: any;
        postcode: any;
        city: any;
        country: any;
        birthday: any;
    }): Promise<any>;
}
export {};
