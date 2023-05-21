import { BasePuppeteer } from "base-puppeteer";
interface ISavedAuthentication {
    email: string;
    password: string;
}
export declare class CoinsbeeClient extends BasePuppeteer {
    auth: null | ISavedAuthentication;
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
    homepage(): Promise<void>;
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
    constructor(o: any);
    checkout(): Promise<void>;
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
    }): Promise<{
        success: boolean;
    }>;
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
