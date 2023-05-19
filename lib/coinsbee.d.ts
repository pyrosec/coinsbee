/// <reference types="node" />
import { SocksProxyAgent } from "socks-proxy-agent";
import https from "https";
import { getLogger } from "./logger";
declare const CookieJarClass: any;
type CookieJar = typeof CookieJarClass;
interface ISavedAuthentication {
    email: string;
    password: string;
}
export declare class CoinsbeeClient {
    logger: ReturnType<typeof getLogger>;
    jar: CookieJar;
    proxyOptions: any;
    insecure: boolean;
    userAgent: string;
    auth: null | ISavedAuthentication;
    static initialize(o: any): Promise<CoinsbeeClient>;
    _makeAgent(): https.Agent | SocksProxyAgent;
    constructor({ logger, jar, userAgent, auth, insecure }: any);
    _call(uri: any, config?: any): Promise<any>;
    static fromObject(o: any): CoinsbeeClient;
    static fromJSON(s: string): CoinsbeeClient;
    toObject(): {
        userAgent: string;
        jar: any;
        auth: ISavedAuthentication;
    };
    toJSON(): string;
    rewriteAndFollowRedirect(response: any): Promise<any>;
    getSignupPage(): Promise<any>;
    login({ email, password }: {
        email: any;
        password: any;
    }): Promise<any>;
    solveCaptcha(pageContent: string): Promise<string>;
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
