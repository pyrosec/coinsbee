import { BasePuppeteer } from "base-puppeteer";
import { ethers } from "ethers";
interface ISavedAuthentication {
    email: string;
    password: string;
}
export declare class CoinsbeeClient extends BasePuppeteer {
    auth: null | ISavedAuthentication;
    shoppingCart(): Promise<any>;
    search({ search }: {
        search: any;
    }): Promise<any[]>;
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
    _matchHref({ name, search }: {
        name: any;
        search: any;
    }): Promise<any>;
    _getProductData({ text, extended }: {
        text: any;
        extended: any;
    }): ({
        currencies: any[];
        metadata: any;
    } | {
        currencies?: undefined;
        metadata?: undefined;
    }) & {
        products: any[];
        brandId: string;
    };
    homepage(): Promise<void>;
    matchProduct({ name, search }: {
        name: any;
        search: any;
    }): Promise<({
        currencies: any[];
        metadata: any;
    } | {
        currencies?: undefined;
        metadata?: undefined;
    }) & {
        products: any[];
        brandId: string;
    }>;
    loadProduct({ name, search }: {
        name: any;
        search: any;
    }): Promise<({
        currencies: any[];
        metadata: any;
    } | {
        currencies?: undefined;
        metadata?: undefined;
    }) & {
        products: any[];
        brandId: string;
    }>;
    _getWallet(): ethers.Wallet;
    checkBalance(): Promise<string>;
    buy({ name, value }: {
        name: any;
        value: any;
    }): Promise<any>;
    match({ name, value }: {
        name: any;
        value: any;
    }): Promise<any>;
    _buy({ products, name, value }: {
        products: any;
        name: any;
        value: any;
    }): Promise<any>;
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
    constructor(o: any);
    checkout({ pay, coin }: {
        pay: any;
        coin?: string;
    }): Promise<any>;
    checkoutProcessing({ currency, nw, pm, discountcode, }: {
        currency?: string;
        nw?: string;
        pm?: string;
        discountcode?: string;
    }): Promise<any>;
    _call(uri: any, config?: any): Promise<any>;
    userOrders({ from, length }: {
        from: any;
        length?: string;
    }): Promise<any>;
    pollOne(): Promise<any>;
    lastOrder(): Promise<{
        orderid: any;
        hash: any;
    }>;
    _processPoll(tick: any, entropy?: number): Promise<any>;
    poll({ entropy }: {
        entropy?: number;
    }): Promise<any>;
    goto(o: any): Promise<{
        success: boolean;
    }>;
    retrieveCodeFromUrl({ url, entropy }: {
        url: any;
        entropy: any;
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
    }): Promise<any>;
    rewriteAndFollowRedirect(response: any): Promise<any>;
    getSignupPage(): Promise<any>;
    login({ email, password }: {
        email: any;
        password: any;
    }): any;
    solveCaptcha(pageContent: string): Promise<string>;
    sharklasers(): Promise<any>;
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
    }): any;
}
export {};
