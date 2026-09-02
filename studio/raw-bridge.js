const script = document.querySelector('script[data-raw-work-id]');
const workId = script?.dataset.rawWorkId;
const params = new URLSearchParams(window.location.search);

if (workId && !params.has('preview')) {
  const target = new URL(`/works/${workId}/`, window.location.origin);
  window.location.replace(target.href);
}
