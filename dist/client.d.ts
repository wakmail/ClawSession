export declare const MODELS: [string, string][];
export declare function resolveModel(input: string): string;
export declare function sendMessage(cookie: string, message: string, model: string, orgId: string, titleMode?: string, customTitle?: string): Promise<string>;
