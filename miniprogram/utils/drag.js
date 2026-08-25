// 通用拖拽排序：行内加 class="drag-row"，手柄绑 onDragStart/Move/End
function startDrag(page, e, listKey) {
  const idx = Number(e.currentTarget.dataset.idx);
  page._dragIdx = idx;
  page.setData({ dragIdx: idx });
  wx.createSelectorQuery().in(page).selectAll('.drag-row').boundingClientRect(function (rects) {
    page._dragRects = rects;
  }).exec();
}

function moveDrag(page, e, listKey, onSwap) {
  if (page._dragIdx === undefined || page._dragIdx === null) return;
  const y = e.touches[0].clientY;
  const rects = page._dragRects || [];
  let target = page._dragIdx;
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    if (y >= r.top - r.height / 2 && y <= r.bottom + r.height / 2) { target = i; break; }
  }
  if (target !== page._dragIdx) {
    const list = page.data[listKey].slice();
    const item = list.splice(page._dragIdx, 1)[0];
    list.splice(target, 0, item);
    page._dragIdx = target;
    page.setData({ dragIdx: target }, function () {
      page.setData({ [listKey]: list }, function () {
        if (onSwap) onSwap(list);
        wx.createSelectorQuery().in(page).selectAll('.drag-row').boundingClientRect(function (rects) {
          page._dragRects = rects;
        }).exec();
      });
    });
  }
}

function endDrag(page, onEnd) {
  page._dragIdx = null;
  page.setData({ dragIdx: -1 });
  if (onEnd) onEnd();
}

module.exports = { startDrag: startDrag, moveDrag: moveDrag, endDrag: endDrag };
