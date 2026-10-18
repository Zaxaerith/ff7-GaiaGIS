// SPDX-License-Identifier: GPL-3.0-only
export const projectionCatalog=[
 ['projection.title','Camera projection diagnostics','Camera 投影诊断','Camera 投影診斷','Camera 投影診断','Camera 투영 진단'],
 ['projection.vertex','Triangle vertex','三角形顶点','三角形頂點','三角形の頂点','삼각형 꼭짓점'],
 ['projection.source','Use selected verified anchor','使用所选已验证锚点','使用所選已驗證錨點','選択した検証済みアンカーを使用','선택한 검증된 앵커 사용'],
 ['projection.refresh','Inspect source projection','检查来源投影','檢查來源投影','元データの投影を調べる','원본 투영 검사'],
 ['projection.query','Find screen footprint candidates','查询屏幕覆盖候选','查詢螢幕覆蓋候選','画面上の候補を検索','화면 영역 후보 검색'],
 ['projection.pick','Inspect Canvas taps','检查 Canvas 点击位置','檢查 Canvas 點選位置','Canvas のタップを調べる','Canvas 탭 위치 검사'],
 ['projection.limit','Footprint candidates do not identify a unique XYZ or establish visibility. Occlusion is unknown.','二维覆盖候选不能确定唯一 XYZ 或真实可见性；遮挡仍未知。','二維覆蓋候選不能確定唯一 XYZ 或真實可見性；遮擋仍未知。','2D 候補から一意の XYZ や可視性は確定できません。遮蔽は不明です。','2D 후보로 고유 XYZ나 실제 가시성을 확정할 수 없습니다. 가림은 알 수 없습니다.'],
 ['projection.missing','No verified source / Camera available.','没有已验证来源或可用 Camera。','沒有已驗證來源或可用 Camera。','検証済み元データまたは Camera がありません。','검증된 원본 또는 Camera가 없습니다.'],
 ['projection.valid','Valid mathematical projection; original-game registration remains unverified.','数学投影有效；原版游戏配准仍未验证。','數學投影有效；原版遊戲配準仍未驗證。','数学的投影は有効です。原作との位置合わせは未検証です。','수학적 투영은 유효합니다. 원작 정합은 검증되지 않았습니다.'],
 ['projection.invalid_depth','Behind Camera or depth ≤ 0.000001.','Camera 后方或深度 ≤ 0.000001。','Camera 後方或深度 ≤ 0.000001。','Camera の背後または深度 ≤ 0.000001。','Camera 뒤쪽 또는 깊이 ≤ 0.000001.'],
 ['projection.invalid_numeric','Non-finite projection input or result.','投影输入或结果不是有限数值。','投影輸入或結果不是有限數值。','投影の入力または結果が有限値ではありません。','투영 입력 또는 결과가 유한수가 아닙니다.'],
 ['projection.outsideBackground','Outside original background rectangle','超出原始背景矩形','超出原始背景矩形','元の背景矩形の外側','원본 배경 사각형 밖'],
 ['projection.outsideCanvas','Outside current Canvas clipping','超出当前 Canvas 裁切','超出目前 Canvas 裁切','現在の Canvas 範囲外','현재 Canvas 영역 밖'],
 ['projection.candidates','Candidates: {triangles} triangles / {tiles} tiles; invalid {invalid}; degenerate {degenerate}.','候选：{triangles} 个三角形 / {tiles} 个 Tile；无效 {invalid}；退化 {degenerate}。','候選：{triangles} 個三角形 / {tiles} 個 Tile；無效 {invalid}；退化 {degenerate}。','候補：三角形 {triangles} / Tile {tiles}、無効 {invalid}、縮退 {degenerate}。','후보: 삼각형 {triangles} / Tile {tiles}; 무효 {invalid}; 퇴화 {degenerate}.'],
] as const;
