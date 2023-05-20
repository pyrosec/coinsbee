/// <reference types="node" resolution-mode="require"/>
import { SocksProxyAgent } from "socks-proxy-agent";
import https from "https";
import { getLogger } from "./logger.js";
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
    shoppingCart(): Promise<any>;
    getListingPage({ offset, cat, region, search, }: {
        offset?: number;
        cat?: string;
        region?: string;
        search?: string;
    }): Promise<any[]>;
    _getHref({ name, search }: {
        name: any;
        search: any;
    }): Promise<any>;
    _getProductData({ text }: {
        text: any;
    }): {
        currencies: any[];
        products: any[];
        brandId: string;
        metadata: any;
    };
    loadProduct({ name, search }: {
        name: any;
        search: any;
    }): Promise<{
        currencies: any[];
        products: any[];
        brandId: string;
        metadata: any;
    }>;
    addToCart({ id, q }: {
        id: any;
        q?: string;
    }): Promise<any>;
    getShoppingCart({ method, id, q }: {
        method?: string;
        id?: any;
        q?: string;
    }): Promise<any>;
    getProducts({ cat, region, search }: {
        cat?: string;
        region?: string;
        search?: string;
    }): Promise<any[]>;
    constructor({ logger, jar, userAgent, auth, insecure }: any);
    checkout(): Promise<any>;
    checkoutProcessing({ currency, nw, pm, discountcode, }: {
        currency?: string;
        nw?: string;
        pm?: string;
        discountcode?: string;
    }): Promise<any>;
    _call(uri: any, config?: any): Promise<any>;
    static fromObject(o: any): CoinsbeeClient;
    static fromJSON(s: string): CoinsbeeClient;
    userOrders({ from, length }: {
        from: any;
        length?: string;
    }): Promise<any>;
    userOrdersDetails({ orderid, hash }: {
        orderid: any;
        hash: any;
    }): Promise<{
        product: any;
        pin: any;
        code: any;
        url: any;
    }>;
    checkoutProceed({ discountcode, terms, coin, network, btnBuyCoinGate, cpf, fullname }: {
        discountcode?: string;
        terms?: string;
        coin?: string;
        network?: number;
        btnBuyCoinGate?: string;
        cpf?: string;
        fullname?: string;
    }): Promise<any[] | {
        config: any;
        payment: any;
    }>;
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
//# sourceMappingURL=coinsbee.d.ts.map