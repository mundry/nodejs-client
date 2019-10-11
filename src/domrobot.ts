import * as otplib from 'otplib';
import { CookieJar } from 'request';
import * as request from 'request-promise-native';

export class DomRobot {
    public static readonly CLIENT_VERSION = '3.0.0';

    public static readonly API_URL_LIVE = 'https://api.domrobot.com/jsonrpc/';
    public static readonly API_URL_OTE = 'https://api.ote.domrobot.com/jsonrpc/';

    public static generateClientTransactionId(): string {
        return 'DomRobot-' + Math.round(Math.random() * 1000000000);
    }

    private apiUrl: string;
    private language: string;
    private debugMode: boolean;

    private cookieJar: CookieJar;

    /**
     * @param apiUrl url of the API.
     * @param language default language for future API requests.
     * @param debugMode whether requests and responses should be printed out.
     */
    constructor(apiUrl: string = DomRobot.API_URL_OTE, language: string = Language.EN, debugMode: boolean = false) {
        this.apiUrl = apiUrl;
        this.language = language;
        this.debugMode = debugMode;
        this.cookieJar = request.jar();
    }

    /**
     * Makes an API call.
     *
     * @param apiMethod The name of the method called in the API.
     * @param methodParams An object of parameters added to the request.
     * @param clientTransactionId Id sent with every request to distinguish your api requests in case you need support.
     * @param language Language for the API request. Default is value of field language.
     */
    public async callApi(
        apiMethod: string,
        methodParams: any = {},
        clientTransactionId: string = DomRobot.generateClientTransactionId(),
        language: string = this.language,
    ): Promise<any> {
        if ('clTRID'! in methodParams && clientTransactionId !== null) {
            methodParams.clTRID = clientTransactionId;
        }
        if ('lang'! in methodParams) {
            methodParams.lang = language;
        }

        const requestBody = JSON.stringify({
            method: apiMethod,
            params: methodParams,
        });

        return request
            .post(this.apiUrl, {
                body: requestBody,
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': `DomRobot/${DomRobot.CLIENT_VERSION} (Node ${process.version})`,
                },
                jar: this.cookieJar,
            })
            .then(response => {
                if (this.debugMode) {
                    console.log(`Request (${apiMethod}): ${requestBody}`);
                    console.log(`Response (${apiMethod}): ${response}`);
                }
                return response;
            })
            .then(response => JSON.parse(response));
    }

    /**
     * Performs a login at the API and saves the session for following API calls.
     *
     * @param username your username.
     * @param password your password.
     * @param sharedSecret
     */
    public async login(username: string, password: string, sharedSecret: string = null): Promise<any> {
        const loginResult = await this.callApi('account.login', { user: username, pass: password });
        if (loginResult.code === 1000 && 'tfa' in loginResult.resData && loginResult.resData.tfa !== '0') {
            if (sharedSecret === null) {
                return Promise.reject('API requests two factor challenge but no shared secret is given. Aborting.');
            }
            const secretCode = otplib.authenticator.generate(sharedSecret);
            const unlockResult = await this.callApi('account.unlock', { tan: secretCode });
            if (unlockResult.code !== 1000) {
                return unlockResult;
            }
        }

        return loginResult;
    }

    /**
     * Performs a logout at the API and destroys the current session.
     */
    public async logout(): Promise<any> {
        return await this.callApi('account.logout').then(() => (this.cookieJar = request.jar()));
    }

    public getApiUrl(): string {
        return this.apiUrl;
    }

    public getLanguage(): string {
        return this.language;
    }

    public setLanguage(value: string) {
        this.language = value;
    }

    public isDebugMode(): boolean {
        return this.debugMode;
    }

    public setDebugMode(value: boolean) {
        this.debugMode = value;
    }
}

/**
 * The API response-message language.
 */
export enum Language {
    EN = 'en',
    DE = 'de',
    ES = 'es',
}