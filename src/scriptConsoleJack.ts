import * as vscode from 'vscode';
import { JenkinsService } from "./jenkinsService";
import { JackBase } from './jack';

export class ScriptConsoleJack extends JackBase {
    private readonly jenkins: JenkinsService;

    constructor() {
        super('Script Console Jack');
        this.jenkins = JenkinsService.instance();
    }

    public getCommands(): any[] {
        return [{
            label: "$(triangle-right)  Script Console: Execute",
            description: "Executes the current view's groovy script as a system/node console script (script console).",
            target: async () => await this.executeScriptConsole(),
        }];
    }

    // @ts-ignore
    protected async executeScriptConsole() {
        // Validate it's valid groovy source.
        var editor = vscode.window.activeTextEditor;
        if (!editor) { return; }
        if ("groovy" !== editor.document.languageId) {
            return;
        }

        // Grab source from active editor.
        let source = editor.document.getText();
        if ("" === source) { return; }

        await this.execute(source);
    }

    public async execute(source: string) {
        let nodes = await this.jenkins.getNodes();
        nodes = nodes.filter((n: any) => n.displayName !== 'master');

        if (undefined === nodes) { return; }
        nodes.map((n: any) => {
            n.label = n.displayName;
            n.description = n.offline ? "$(alert)" : "";
        });

        let options = Object.assign([], nodes);
        options.unshift({
            label: "System",
            description: "Executes from the System Script Console found in 'Manage Jenkins'."
        });
        options.unshift({
            label: ".*",
            description: "Regex of the nodes you would like to target."
        });

        // Grab initial selection from the user.
        let selection = await vscode.window.showQuickPick(options) as any;
        if (undefined === selection) { return; }

        let targetMachines: any[] = [];

        // If regex specified, grab a pattern from the user to
        // filter on the list of nodes.
        if ('.*' === selection.label) {

            // Grab regex pattern from user.
            let pattern = await vscode.window.showInputBox();
            if (undefined === pattern) { return; }

            // Match against list of nodes.
            let matches = [];
            for (let n of nodes) {
                let name = n.displayName as string;
                let match = name.match(pattern);
                if (null !== match && match.length >= 0) {
                    matches.push(n);
                }
            }

            // Allow the user to select nodes retrieved from regex.
            let selections = await vscode.window.showQuickPick(matches, { canPickMany: true } );
            if (undefined === selections) { return; }
            targetMachines = targetMachines.concat(selections.map(s => s.label));
        }
        else if ('System' === selection.label) {
            targetMachines.push('System');
        }
        else {
            targetMachines.push(selection.label);
        }

        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Console Script(s)`,
            cancellable: true
        }, async (progress, token) => {
            token.onCancellationRequested(() => {
                this.showWarningMessage(`User canceled script console execute.`, undefined);
            });

            // Builds a list of console script http requests across the list of targeted machines
            // and awaits across all.
            let tasks = [];
            progress.report({ increment: 50, message: "Executing on target machine(s)" });
            for (let m of targetMachines) {
                let promise = undefined;
                if ('System' === m) {
                    promise = new Promise(async (resolve) => {
                        let result = await this.jenkins.runConsoleScript(source);
                        return resolve({ node: 'System', output: result });
                    });
                }
                else {
                    promise = new Promise(async (resolve) => {
                        let result = await this.jenkins.runConsoleScript(source, m);
                        return resolve({ node: m, output: result });
                    });
                }
                tasks.push(promise);
            }
            let results = await Promise.all(tasks);

            // Iterate over the result list, printing the name of the
            // machine and it's output.
            this.outputChannel.clear();
            this.outputChannel.show();
            for (let r of results as any[]) {
                this.outputChannel.appendLine(this.barrierLine);
                this.outputChannel.appendLine(r.node);
                this.outputChannel.appendLine('');
                this.outputChannel.appendLine(r.output);
                this.outputChannel.appendLine(this.barrierLine);
            }
            progress.report({ increment: 50, message: `Output retrieved. Displaying in OUTPUT channel...` });
        });
    }
}