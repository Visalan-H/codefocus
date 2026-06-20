// Resolves the best available Wandbox compiler for a given language key,
// preferring a -head alias (always valid) over a pinned version that may go stale.

const WANDBOX_LANGUAGE = {
  cpp:    'C++',
  python: 'Python',
  java:   'Java',
};

let listPromise = null;

function fetchList() {
  if (!listPromise) {
    listPromise = fetch('https://wandbox.org/api/list.json').then(function (response) {
      if (!response.ok) {
        throw new Error('Wandbox compiler list request failed (' + response.status + ')');
      }
      return response.json();
    });
  }
  return listPromise;
}

function compareVersions(a, b) {
  const pa = String(a).split(/[.-]/).map(Number);
  const pb = String(b).split(/[.-]/).map(Number);
  const len = Math.max(pa.length, pb.length);

  for (let i = 0; i < len; i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff) return diff;
  }
  return 0;
}

export async function resolveCompiler(langKey) {
  const wandboxLanguage = WANDBOX_LANGUAGE[langKey];
  let list;

  try {
    list = await fetchList();
  } catch (e) {
    throw new Error("Couldn't reach Wandbox's compiler list — " + e.message);
  }

  const candidates = list.filter(function (c) { return c.language === wandboxLanguage; });
  if (!candidates.length) {
    throw new Error('No Wandbox compiler available for ' + wandboxLanguage);
  }

  const head = candidates.find(function (c) { return /-head$/.test(c.name); });
  if (head) return head.name;

  candidates.sort(function (a, b) { return compareVersions(b.version, a.version); });
  return candidates[0].name;
}
