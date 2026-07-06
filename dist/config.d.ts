export interface ScheduleEntry {
    time: string;
    message: string;
    model?: string;
}
export interface Config {
    model: string;
    title: string;
    schedule: ScheduleEntry[];
}
export declare function getConfigPath(): string;
export declare function loadConfig(): Config;
export declare function saveConfig(config: Config): void;
export declare function getCredentials(): {
    cookie: string;
    orgId: string;
};
