"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SentryIssueData = void 0;
exports.createStacktrace = createStacktrace;
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
function createStacktrace(latestEvent) {
    var _a;
    const stacktraces = [];
    for (const entry of latestEvent.entries || []) {
        if (entry.type !== 'exception') {
            continue;
        }
        const exceptionData = entry.data.values;
        for (const exception of exceptionData) {
            const exceptionType = exception.type || 'Unknown';
            const exceptionValue = exception.value || '';
            const stacktrace = exception.stacktrace;
            let stacktraceText = `Exception: ${exceptionType}: ${exceptionValue}\n\n`;
            if (stacktrace) {
                stacktraceText += 'Stacktrace:\n';
                for (const frame of stacktrace.frames || []) {
                    const filename = frame.filename || 'Unknown';
                    const lineno = ((_a = frame.lineNo) === null || _a === void 0 ? void 0 : _a.toString()) || '?';
                    const functionName = frame.function || 'Unknown';
                    stacktraceText += `${filename}:${lineno} in ${functionName}\n`;
                    if (frame.context) {
                        for (const [_, line] of frame.context) {
                            stacktraceText += `    ${line}\n`;
                        }
                    }
                    stacktraceText += '\n';
                }
            }
            stacktraces.push(stacktraceText);
        }
    }
    return stacktraces.length > 0 ? stacktraces.join('\n') : 'No stacktrace found';
}
class SentryIssueData {
    constructor(option) {
        this.option = null;
        this.option = option;
    }
    toText() {
        var _a, _b, _c, _d, _e, _f, _g;
        return (`Sentry Issue: ${(_a = this.option) === null || _a === void 0 ? void 0 : _a.title}\n\n` +
            `Issue ID: ${(_b = this.option) === null || _b === void 0 ? void 0 : _b.issueId}\n` +
            `Status: ${(_c = this.option) === null || _c === void 0 ? void 0 : _c.status}\n` +
            `Level: ${(_d = this.option) === null || _d === void 0 ? void 0 : _d.level}\n` +
            `First Seen: ${(_e = this.option) === null || _e === void 0 ? void 0 : _e.firstSeen}\n` +
            `Last Seen:${(_f = this.option) === null || _f === void 0 ? void 0 : _f.lastSeen}\n` +
            `Count: ${(_g = this.option) === null || _g === void 0 ? void 0 : _g.count}\n`);
    }
    toPromotResult() {
        var _a;
        return types_js_1.GetPromptResultSchema.parse({
            description: `Sentry Issue: ${(_a = this.option) === null || _a === void 0 ? void 0 : _a.title}`,
            messages: [
                types_js_1.PromptMessageSchema.parse({
                    role: 'user',
                    content: types_js_1.TextContentSchema.parse({
                        type: 'text',
                        text: this.toText(),
                    }),
                }),
            ],
        });
    }
}
exports.SentryIssueData = SentryIssueData;
//# sourceMappingURL=utils.js.map