# GitHub MCP Server

Gives your AI assistant direct access to GitHub APIs — read issues, pull requests, files, commits, and repository metadata without leaving the IDE.

## Requirements

| Prerequisite | Details |
|---|---|
| Node.js | v18 or later |
| `GITHUB_PERSONAL_ACCESS_TOKEN` | A GitHub PAT with the scopes your workflows need (see below) |

### Recommended PAT scopes

| Scope | Why |
|---|---|
| `repo` | Read/write access to private and public repositories |
| `read:org` | Read org membership (needed for org-level queries) |
| `read:user` | Read user profile data |
| `gist` | Read/write gists (optional) |

Create a fine-grained PAT at **GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens** and scope it to the repositories you work with.

## Available Tools

Once installed, your AI assistant can use these tools directly in conversation:

| Tool | Description |
|---|---|
| `search_repositories` | Search GitHub for repositories by query |
| `get_file_contents` | Read a file from any repository |
| `list_issues` | List issues on a repository with filters |
| `get_issue` | Get a single issue by number |
| `create_issue` | Open a new issue |
| `search_issues` | Search issues and PRs across GitHub |
| `list_pull_requests` | List PRs on a repository |
| `get_pull_request` | Get PR details including diff |
| `list_commits` | List commits on a branch |
| `get_commit` | Get a single commit with diff |
| `create_or_update_file` | Write or update a file in a repository |
| `push_files` | Push multiple file changes in one commit |
| `create_branch` | Create a new branch |
| `fork_repository` | Fork a repository |

## Installation

This asset is installed via `ai-stash`. Once installed, the MCP server config is merged into your project's `.mcp.json` (for Copilot) or your Claude Code settings.

You must set the environment variable before starting your IDE:

```bash
export GITHUB_PERSONAL_ACCESS_TOKEN=ghp_your_token_here
```

Or add it to your shell profile / `.env` (ensure `.env` is gitignored).

## Source

Official MCP server maintained by Anthropic:
[`@modelcontextprotocol/server-github`](https://github.com/modelcontextprotocol/servers/tree/main/src/github)
