import * as fs from 'fs';
import * as path from 'path';

import { readjson, writejson } from './utils';

export class PipelineConfig {
    public name: string;
    public params: any;
    public interactiveInputOverride: any;
    public folder: string | undefined;
    private path: string;

    constructor(scriptPath: string) {
        let parsed = path.parse(scriptPath);
        let configFileName = `.${parsed.name}.config.json`;
        this.path = path.join(parsed.dir, configFileName);

        // If config doesn't exist, write out defaults.
        if (!fs.existsSync(this.path)) {
            this.name = parsed.name;
            this.params = null;
            this.folder = undefined;
            this.save();
            return;
        }
        let json = readjson(this.path);
        this.name = json.name;
        this.params = json.params;
        this.interactiveInputOverride = json.interactiveInputOverride;
        this.folder = json.folder;
    }

    toJSON(): any {
        return {
            name: this.name,
            params: this.params,
            interactiveInputOverride: this.interactiveInputOverride,
            folder: this.folder
        };
    }

    fromJSON(json: any): PipelineConfig {
        let pc = Object.create(PipelineConfig.prototype);
        return Object.assign(pc, json, {
            name: json.name,
            params: json.params,
            interactiveInputOverride: json.interactiveInputOverride,
            folder: json.folder
        });
    }

    buildableName(): string {
        if (undefined === this.folder || '' === this.folder) {
            return this.name;
        }
        return `${this.folder}/${this.name}`;
    }


    /**
     * Saves the current pipeline configuration to disk.
     */
    public save() {
        writejson(this.path, this);
    }

    /**
     * Updates the class properties with the saved
     * configuration values.
     */
    public update() {
        let json = readjson(this.path);
        this.name = json.name;
        this.params = json.params;
        this.interactiveInputOverride = json.interactiveInputOverride;
        this.folder = json.folder;
    }
}