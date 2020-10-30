function getScrollPercent(currentScroll) {
  const totalHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;

  if (currentScroll === 0) {
    return 0;
  }

  return (currentScroll / totalHeight * 100);
}

export default getScrollPercent;
