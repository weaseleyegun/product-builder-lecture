// js/admin.js - Frontend logic for Admin Dashboard and Editor

document.addEventListener('DOMContentLoaded', function () {
    const quizList = document.getElementById('admin-quiz-list');
    const worldcupList = document.getElementById('admin-worldcup-list');
    const editForm = document.getElementById('admin-edit-form');
    const thumbnailInput = document.getElementById('edit-thumbnail');
    const thumbnailPreview = document.getElementById('thumbnail-preview');

    // 1. Dashboard Logic: Fetch all items
    if (quizList || worldcupList) {
        fetchAllContent();
    }

    async function fetchAllContent() {
        try {
            // Re-use current public APIs but display more info
            const quizRes = await fetch(API_BASE_URL + '/api/daily-quiz?sort=latest');
            const worldcupRes = await fetch(API_BASE_URL + '/api/worldcups');

            if (quizRes.ok) {
                const quizzes = await quizRes.json();
                renderAdminList(quizList, quizzes, 'quiz');
            }
            if (worldcupRes.ok) {
                const worldcups = await worldcupRes.json();
                renderAdminList(worldcupList, worldcups, 'worldcup');
            }
        } catch (err) {
            console.error("Admin Fetch Error:", err);
        }
    }

    function renderAdminList(container, items, type) {
        if (!container) return;
        container.innerHTML = items.map(item => `
            <div class="admin-card" style="display: flex; align-items: center; gap: 1rem; padding: 1rem; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 12px; margin-bottom: 0.8rem;">
                <div style="width: 60px; height: 60px; border-radius: 8px; background: url('${item.thumbnail_url || 'https://via.placeholder.com/60'}') center/cover no-repeat, var(--primary-color); flex-shrink: 0;"></div>
                <div style="flex-grow: 1;">
                    <h4 style="margin: 0; font-size: 1rem;">${item.title}</h4>
                    <p style="margin: 0; font-size: 0.85rem; color: var(--text-muted);">${item.description ? item.description.substring(0, 50) + '...' : '설명 없음'}</p>
                </div>
                <button class="btn-primary" onclick="location.href='admin-edit.html?type=${type}&id=${item.id}'" style="padding: 0.5rem 1rem; font-size: 0.85rem;">관리</button>
            </div>
        `).join('');
    }

    // 2. Editor Logic: Handle edit form
    if (editForm) {
        const urlParams = new URLSearchParams(window.location.search);
        const type = urlParams.get('type');
        const id = urlParams.get('id');

        if (!type || !id) {
            alert("잘못된 접근입니다.");
            location.href = 'admin-dashboard.html';
            return;
        }

        fetchItemDetails(type, id);

        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = editForm.querySelector('button[type="submit"]');
            btn.disabled = true;
            btn.textContent = '저장 중...';

            const payload = {
                title: document.getElementById('edit-title').value,
                description: document.getElementById('edit-description').value,
                thumbnail_url: document.getElementById('edit-thumbnail').value
            };

            try {
                const res = await fetch(`${API_BASE_URL}/api/admin/${type}/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (res.ok) {
                    alert('성공적으로 수정되었습니다!');
                    location.href = 'admin-dashboard.html';
                } else {
                    const err = await res.json();
                    alert('수정 실패: ' + (err.error || 'Unknown error'));
                }
            } catch (err) {
                alert('서버 오류: ' + err.message);
            } finally {
                btn.disabled = false;
                btn.textContent = '저장하기';
            }
        });

        // Real-time preview
        thumbnailInput.addEventListener('input', (e) => {
            const url = e.target.value;
            thumbnailPreview.style.backgroundImage = url ? `url('${url}')` : 'none';
        });
    }

    async function fetchItemDetails(type, id) {
        try {
            // Using existing play APIs which return single item info
            const endpoint = type === 'quiz' ? `${API_BASE_URL}/api/quiz-play?id=${id}&limit=1` : `${API_BASE_URL}/api/worldcup-play?id=${id}`;
            const res = await fetch(endpoint);
            if (res.ok) {
                const data = await res.json();
                const item = type === 'quiz' ? data.quiz : data.worldcup;

                document.getElementById('edit-title').value = item.title;
                document.getElementById('edit-description').value = item.description || '';
                document.getElementById('edit-thumbnail').value = item.thumbnail_url || '';
                if (item.thumbnail_url) thumbnailPreview.style.backgroundImage = `url('${item.thumbnail_url}')`;
            }
        } catch (err) {
            console.error("Fetch detail error:", err);
        }
    }
});
