import * as vscode from 'vscode';
import { JackBase } from './jack';
import { JenkinsHostManager } from './jenkinsHostManager';

export class NodeJack extends JackBase {

    constructor() {
        super('Node Jack');
    }

    public getCommands(): any[] {
        return [
            {
                label: "$(stop)  Node: Set Offline",
                description: "Mark targeted nodes offline with a message.",
                target: async () => await this.setOffline()
            },
            {
                label: "$(check)  Node: Set Online",
                description: "Mark targeted nodes online.",
                target: async () => await this.setOnline()
            },
            {
                label: "$(circle-slash)  Node: Disconnect",
                description: "Disconnects targeted nodes from the host.",
                target: async () => await this.disconnect()
            }
        ];
    }

    /**
     * Allows the user to select multiple offline nodes to be
     * re-enabled.
     */
    public async setOnline() {
        await this.onNodes(async (label: string) => {
            await JenkinsHostManager.host.client.node.enable(label);
            return 'Node Online!'
        }, (n: any) => n.displayName !== 'master' && n.offline);
    }

    /**
     * Allows the user to select multiple online nodes to
     * be set in a temporary offline status, with a message.
     */
    public async setOffline() {
        let offlineMessage = await vscode.window.showInputBox({ prompt: 'Enter an offline message.' });
        if (undefined === offlineMessage) { return; }

        await this.onNodes(async (label: string) => {
            await JenkinsHostManager.host.client.node.disable(label, offlineMessage);
            return 'Node Offline'
        }, (n: any) => n.displayName !== 'master' && !n.offline);
    }

    /**
     * Allows the user to select multiple nodes to be
     * disconnected from the server.
     */
    public async disconnect() {
        await this.onNodes(async (label: string) => {
            await JenkinsHostManager.host.client.node.disconnect(label);
            return 'Disconnected'
        }, (n: any) => n.displayName !== 'master');
    }

    /**
     * Handles an input flow for performing and action on targeted nodes.
     * @param onNodeAction Async callback that runs an action on a node
     * label and returns output.
     * @param filter Optional filter on a jenkins API node.
     */
    private async onNodes(
        onNodeAction: (node: string) => Promise<string>,
        filter: ((node: any) => boolean) | undefined = undefined): Promise<any> {

        let nodes = await JenkinsHostManager.host.getNodes();
        if (undefined !== filter) {
            nodes = nodes.filter(filter);
        }

        if (undefined === nodes) { return; }
        nodes.map((n: any) => {
            n.label = n.displayName;
            n.description = n.offline ? "$(alert)" : "$(check)";
            n.target = n
        });

        if (0 >= nodes.length) {
            this.showInformationMessage('No nodes found outside of "master"');
            return;
        }

        let selections = await vscode.window.showQuickPick(nodes, { canPickMany: true }) as any;
        if (undefined === selections) { return; }

        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Node Jack Output(s)`,
            cancellable: true
        }, async (progress, token) => {
            token.onCancellationRequested(() => {
                this.showWarningMessage("User canceled node command.");
            });

            // Builds a list of parallel actions across the list of targeted machines
            // and awaits across all.
            let tasks = [];
            progress.report({ increment: 50, message: "Executing on target machine(s)" });
            for (let m of selections) {
                let promise = new Promise(async (resolve) => {
                    try {
                        let output = await onNodeAction(m.label);
                        return resolve({ node: m.label, output: output })
                    } catch (err) {
                        return resolve({ node: m.label, output: err })
                    }
                });
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
