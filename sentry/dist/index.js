"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const axios_1 = __importDefault(require("axios"));
const utils_1 = require("./utils");
const sentryBaseUrl = process.env.SENTRY_BASE_URL || 'https://dpsentry.shopee.io/api/0/';
const sentryApiKey = process.env.SENTRY_API_KEY ||
    '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';
class SentryServer {
    constructor() {
        this.server = new index_js_1.Server({ name: 'mcp-server-sentry', version: '1.0.0' }, { capabilities: { tools: {} } });
        this.axiosInstance = axios_1.default.create({
            baseURL: sentryBaseUrl,
            headers: {
                Authorization: `Bearer ${sentryApiKey}`,
            },
        });
        this.setupToolHandlers();
    }
    setupToolHandlers() {
        this.server.setRequestHandler(types_js_1.ListToolsRequestSchema, () => __awaiter(this, void 0, void 0, function* () {
            return {
                tools: [
                    {
                        name: 'get_sentry_issue',
                        description: `Retrieve and analyze a Sentry issue by ID or URL. Use this tool when you need to:
                - Investigate production errors and crashes
                - Access detailed stacktraces from Sentry
                - Analyze error patterns and frequencies
                - Get information about when issues first/last occurred
                - Review error counts and status`,
                        parameters: {
                            type: 'object',
                            properties: {
                                issue_id_or_url: {
                                    type: 'string',
                                    description: 'Sentry issue ID or URL to analyze',
                                },
                            },
                            required: ['issue_id_or_url'],
                        },
                    },
                ],
            };
        }));
        this.server.setRequestHandler(types_js_1.CallToolRequestSchema, (request) => __awaiter(this, void 0, void 0, function* () {
            if (request.params.name !== 'get_sentry_issue') {
                throw new types_js_1.McpError(types_js_1.ErrorCode.MethodNotFound, `Tool ${request.params.name} not found`);
            }
            if (!request.params.arguments ||
                !request.params.arguments.issue_id_or_url) {
                throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidParams, 'Missing required argument: issue_id_or_url');
            }
            const issueData = yield this.handleSentryIssue(request.params.arguments.issue_id_or_url);
            return issueData.toPromotResult();
        }));
    }
    handleSentryIssue(issueIdOrUrl) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const rsp = yield this.axiosInstance.get(`/issues/${issueIdOrUrl}/`);
                const issue_data = rsp.data;
                const hashes_response = yield this.axiosInstance.get(`/issues/${issueIdOrUrl}/hashes/`);
                const hashes = hashes_response.data;
                const latest_event = hashes[0]['latestEvent'];
                const stacktrace = (0, utils_1.createStacktrace)(latest_event);
                return new utils_1.SentryIssueData({
                    issueId: issue_data['id'],
                    title: issue_data['title'],
                    status: issue_data['status'],
                    count: issue_data['count'],
                    firstSeen: issue_data['firstSeen'],
                    lastSeen: issue_data['lastSeen'],
                    level: issue_data['level'],
                    stacktrace: stacktrace,
                });
            }
            catch (error) {
                throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, error.message);
            }
        });
    }
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            const transport = new stdio_js_1.StdioServerTransport();
            yield this.server.connect(transport);
            console.error('Dify MCP server running on stdio');
        });
    }
}
const server = new SentryServer();
server.run();
//# sourceMappingURL=index.js.map