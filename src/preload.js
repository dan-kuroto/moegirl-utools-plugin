// 历史记录按访问先后顺序排列存储(新在前)，但显示时按查询频率降序排序
const HISTORY_KEY = "history";
// 最多存储HISTORY_CAPACITY条历史记录
const HISTORY_CAPACITY = 5;

// 利用dom去掉HTML表情，如 "a<span>b</span>c" => "abc"
function removeHtmlTag(htmlStr) {
  const e = document.createElement("div");
  e.innerHTML = htmlStr;
  return e.textContent || e.innerText;
}

/**
 * 插入历史搜索记录，新记录插在最前面，如果已存在就移动到前面并更新访问频次
 * 如果超出HISTORY_CAPACITY就删除访问频次最少的记录
 */
function insertHistory(item) {
  let history = queryHistory();
  const index = history.findIndex((h) => h.pageid === item.pageid);
  if (index !== -1) {
    const [h] = history.splice(index, 1);
    item.count = h.count + 1;
    history.unshift(item);
  } else {
    item.count = 1;
    history.unshift(item);
    if (history.length > HISTORY_CAPACITY) {
      history.pop();
    }
  }
  window.utools.dbStorage.setItem(HISTORY_KEY, history);
}

// 获取历史搜索记录，按照访问频次排序后返回
function queryHistory() {
  const history = window.utools.dbStorage.getItem(HISTORY_KEY) ?? [];
  return history.sort((a, b) => b.count - a.count);
}

// 搜索萌娘百科
async function searchMoeGirl(keyword) {
  const formData = new FormData();
  formData.append("action", "query");
  formData.append("format", "json");
  formData.append("formatversion", "2");
  formData.append("errorformat", "html");
  formData.append("prop", "pageimages|categories");
  formData.append("list", "search");
  formData.append("generator", "search");
  formData.append("piprop", "thumbnail");
  formData.append("pithumbsize", "100");
  formData.append("clshow", "!hidden");
  formData.append("cllimit", "5");
  formData.append("srsearch", keyword);
  formData.append("srqiprofile", "classic");
  formData.append("srprop", "snippet|titlesnippet|wordcount|timestamp");
  formData.append("gsrsearch", keyword);
  formData.append("gsrqiprofile", "classic");

  try {
    const response = await fetch("https://zh.moegirl.org.cn/api.php", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    console.log("Success:", data);

    // 没找到办法在这里用网络图片，就暂时默认用本地的icon了
    // const id2Img = (data?.query?.page ?? []).reduce((acc, item) => {
    //   if (item.pageid && item.thumbnail?.source) {
    //     acc[item.pageid] = item.thumbnail.source;
    //   }
    //   return acc;
    // }, {});
    const results = (data?.query?.search ?? []).map((item) => {
      const result = {
        pageid: item.pageid,
        title: item.title,
        description: removeHtmlTag(item.snippet),
        url: `https://zh.moegirl.org.cn/${encodeURIComponent(item.title)}`,
      };
      // if (id2Img[item.pageid]) {
      //   result.icon = id2Img[item.pageid];
      // } else {
      result.icon = "logo.png";
      // }
      return result;
    });
    return results;
  } catch (error) {
    console.error("Error:", error);
    throw error;
  }
}

window.exports = {
  search: {
    mode: "list", // 列表模式
    args: {
      // 进入插件应用时调用（可选）
      enter: (action, callbackSetList) => {
        // 如果进入插件应用就要显示列表数据
        callbackSetList(queryHistory());
      },
      // 子输入框内容变化时被调用 可选 (未设置则无搜索)
      search: (action, searchWord, callbackSetList) => {
        searchWord = searchWord.trim();
        if (!searchWord) {
          // 搜索框为空时，显示历史搜索记录
          callbackSetList(queryHistory());
        } else {
          // 搜索
          searchMoeGirl(searchWord).then((data) => {
            callbackSetList(data);
          });
        }
      },
      // 用户选择列表中某个条目时被调用
      select: (action, itemData, callbackSetList) => {
        window.utools.hideMainWindow();
        const url = itemData.url;
        if (url) {
          // 开浏览器
          window.utools.shellOpenExternal(url);
          // 保存历史记录
          insertHistory(itemData);
        } else {
          // 错误提示
          window.utools.showNotification("该条目没有链接");
        }
        window.utools.outPlugin();
      },
      // 子输入框为空时的占位符，默认为字符串"搜索"
      placeholder: "搜索",
    },
  },
};
