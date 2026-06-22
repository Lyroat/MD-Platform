/**
 * GitLab API 客户端
 * 封装 GitLab REST API 调用
 */

const getGitlabUrl = () => process.env.GITLAB_URL || '';
const getGitlabToken = () => process.env.GITLAB_TOKEN || '';

interface GitlabFetchOptions {
  method?: string;
  body?: string;
  accessToken?: string;
}

/**
 * 通用 GitLab API 请求
 */
async function gitlabFetch(endpoint: string, options: GitlabFetchOptions = {}) {
  const { method = 'GET', body, accessToken } = options;
  const token = accessToken || getGitlabToken();
  const baseUrl = getGitlabUrl();

  if (!baseUrl || !token) {
    throw new Error('GitLab 配置缺失: 请设置 GITLAB_URL 和 GITLAB_TOKEN 环境变量');
  }

  const url = `${baseUrl}/api/v4${endpoint}`;
  const headers: Record<string, string> = {
    'PRIVATE-TOKEN': token,
    'Content-Type': 'application/json',
  };

  const res = await fetch(url, {
    method,
    headers,
    body,
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`GitLab API 错误 (${res.status}): ${errorText}`);
  }

  return res.json();
}

/**
 * 获取组内所有项目
 */
export async function getGroupProjects(groupPath: string) {
  const encoded = encodeURIComponent(groupPath);
  return gitlabFetch(`/groups/${encoded}/projects?per_page=100&order_by=name&sort=asc`);
}

/**
 * 获取仓库文件树
 */
export async function getRepoTree(projectId: string | number, path: string = '', ref: string = 'main') {
  const params = new URLSearchParams({
    path,
    ref,
    per_page: '100',
    recursive: 'false',
  });
  return gitlabFetch(`/projects/${projectId}/repository/tree?${params}`);
}

/**
 * 获取单个文件内容
 */
export async function getFileContent(projectId: string | number, filePath: string, ref: string = 'main') {
  const encodedPath = encodeURIComponent(filePath);
  const data = await gitlabFetch(`/projects/${projectId}/repository/files/${encodedPath}?ref=${ref}`);
  // GitLab 返回 base64 编码的内容
  const content = Buffer.from(data.content, 'base64').toString('utf-8');
  return { ...data, content };
}

/**
 * 保存文件到 GitLab（创建 commit）
 */
export async function saveFile(
  projectId: string | number,
  filePath: string,
  content: string,
  commitMessage: string,
  branch: string = 'main'
) {
  const encodedPath = encodeURIComponent(filePath);

  // 先检查文件是否存在（决定用 create 还是 update）
  let method = 'PUT'; // update
  try {
    await gitlabFetch(`/projects/${projectId}/repository/files/${encodedPath}?ref=${branch}`);
  } catch {
    method = 'POST'; // create
  }

  return gitlabFetch(`/projects/${projectId}/repository/files/${encodedPath}`, {
    method,
    body: JSON.stringify({
      branch,
      content,
      commit_message: commitMessage,
      encoding: 'text',
    }),
  });
}

/**
 * 获取文件的提交历史
 */
export async function getFileHistory(projectId: string | number, filePath: string, ref: string = 'main') {
  const params = new URLSearchParams({
    path: filePath,
    ref_name: ref,
    per_page: '20',
  });
  return gitlabFetch(`/projects/${projectId}/repository/commits?${params}`);
}
