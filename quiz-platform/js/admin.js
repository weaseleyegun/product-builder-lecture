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

        // Helper functions for thumbnail logic
        function getQuizMeta(title) {
            if (typeof QUIZ_META === 'undefined') return { thumbnail: '' };
            const match = QUIZ_META.find(m => title && title.includes(m.keyword));
            return match || { thumbnail: '' };
        }

        function getWorldcupMeta(title) {
            if (typeof WORLDCUP_META === 'undefined') return null;
            const match = WORLDCUP_META.find(m => title && title.includes(m.keyword));
            return match || null;
        }

        function extractThumbnail(item) {
            if (item.description && item.description.includes('[THUMBNAIL_URL:')) {
                const match = item.description.match(/\[THUMBNAIL_URL:(.*?)\]/);
                if (match) return match[1].trim();
            }
            return null;
        }

        function cleanDescription(desc) {
            if (!desc) return '';
            return desc.replace(/\[THUMBNAIL_URL:.*?\]/g, '').replace(/\[HASHTAGS:.*?\]/g, '').trim();
        }

        container.innerHTML = items.map(item => {
            // Priority: thumbnail_url > metadata description > default metadata
            let thumb = item.thumbnail_url || extractThumbnail(item);

            if (!thumb) {
                if (type === 'quiz') {
                    const meta = getQuizMeta(item.title);
                    thumb = meta ? meta.thumbnail : '';
                } else {
                    const meta = getWorldcupMeta(item.title);
                    thumb = meta ? meta.thumbnail : '';
                }
            }

            const thumbStyle = thumb
                ? `background: url('${thumb}') center/cover no-repeat; border: none;`
                : `background: var(--primary-color); opacity: 0.7;`;

            return `
                <div class="admin-card" style="display: flex; align-items: center; gap: 1rem; padding: 1rem; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 12px; margin-bottom: 0.8rem;">
                    <div style="width: 60px; height: 60px; border-radius: 8px; ${thumbStyle} flex-shrink: 0;"></div>
                    <div style="flex-grow: 1;">
                        <h4 style="margin: 0; font-size: 1rem;">${item.title}</h4>
                        <p style="margin: 0; font-size: 0.85rem; color: var(--text-muted);">${cleanDescription(item.description).substring(0, 50)}...</p>
                    </div>
                    <button class="btn-primary" onclick="location.href='admin-edit.html?type=${type}&id=${item.id}'" style="padding: 0.5rem 1rem; font-size: 0.85rem;">관리</button>
                </div>
            `;
        }).join('');
    }

    // 2. Editor Logic: Handle edit form
    let hashtags = [];

    if (editForm) {
        const urlParams = new URLSearchParams(window.location.search);
        const type = urlParams.get('type');
        const id = urlParams.get('id');
        const hashtagInput = document.getElementById('hashtag-input');
        const hashtagList = document.getElementById('hashtag-list');
        const dropZone = document.getElementById('thumb-drop-zone');
        const fileInput = document.getElementById('thumb-file-input');

        if (!type || !id) {
            alert("잘못된 접근입니다.");
            location.href = 'admin-dashboard.html';
            return;
        }

        fetchItemDetails(type, id);

        // Hashtag management
        if (hashtagInput) {
            hashtagInput.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    let val = this.value.trim().replace(/#/g, '');
                    if (val && !hashtags.includes(val)) {
                        if (hashtags.length >= 5) {
                            alert('해시태그는 최대 5개까지 등록 가능합니다.');
                            return;
                        }
                        hashtags.push(val);
                        renderHashtags();
                    }
                    this.value = '';
                }
            });
        }

        function renderHashtags() {
            hashtagList.innerHTML = hashtags.map(tag => `
                <span class="hashtag-badge">#${tag} <span class="remove" onclick="removeHashtag('${tag}')">&times;</span></span>
            `).join('');
        }

        window.removeHashtag = function (tag) {
            hashtags = hashtags.filter(t => t !== tag);
            renderHashtags();
        };

        // Drag & Drop for Thumbnail
        if (dropZone) {
            dropZone.addEventListener('click', () => fileInput.click());

            fileInput.addEventListener('change', (e) => {
                if (fileInput.files.length) {
                    updateThumbnailPreview(fileInput.files[0]);
                }
            });

            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropZone.classList.add('drop-zone--over');
            });

            ['dragleave', 'dragend'].forEach(type => {
                dropZone.addEventListener(type, () => {
                    dropZone.classList.remove('drop-zone--over');
                });
            });

            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                if (e.dataTransfer.files.length) {
                    fileInput.files = e.dataTransfer.files;
                    updateThumbnailPreview(e.dataTransfer.files[0]);
                }
                dropZone.classList.remove('drop-zone--over');
            });
        }

        function updateThumbnailPreview(file) {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                let thumbElement = dropZone.querySelector('.drop-zone__thumb');
                if (!thumbElement) {
                    thumbElement = document.createElement('div');
                    thumbElement.className = 'drop-zone__thumb';
                    dropZone.appendChild(thumbElement);
                }
                thumbElement.style.backgroundImage = `url('${reader.result}')`;

                // CRITICAL FIX: Update the actual input value so it gets saved to the database
                const thumbInput = document.getElementById('edit-thumbnail');
                if (thumbInput) {
                    thumbInput.value = reader.result;
                    // Trigger input event to ensure any listener knows it changed
                    thumbInput.dispatchEvent(new Event('input'));
                }
            };
        }

        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = editForm.querySelector('button[type="submit"]');
            btn.disabled = true;
            btn.textContent = '저장 중...';

            let desc = document.getElementById('edit-description').value;
            // Clean up existing tags/thumbs in description to keep it tidy
            desc = desc.replace(/\[THUMBNAIL_URL:.*?\]/g, '').replace(/\[HASHTAGS:.*?\]/g, '').trim();

            if (hashtags.length > 0) {
                desc += '\n[HASHTAGS:' + hashtags.join(',') + ']';
            }

            const payload = {
                title: document.getElementById('edit-title').value,
                description: desc,
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

        // Real-time preview for URL input
        thumbnailInput.addEventListener('input', (e) => {
            const url = e.target.value;
            let thumbElement = dropZone.querySelector('.drop-zone__thumb');
            if (url) {
                if (!thumbElement) {
                    thumbElement = document.createElement('div');
                    thumbElement.className = 'drop-zone__thumb';
                    dropZone.appendChild(thumbElement);
                }
                thumbElement.style.backgroundImage = `url('${url}')`;
            } else if (thumbElement) {
                thumbElement.remove();
            }
        });
    }

    async function fetchItemDetails(type, id) {
        try {
            const endpoint = type === 'quiz' ? `${API_BASE_URL}/api/quiz-play?id=${id}&limit=1` : `${API_BASE_URL}/api/worldcup-play?id=${id}`;
            const res = await fetch(endpoint);
            if (res.ok) {
                const data = await res.json();
                const item = type === 'quiz' ? data.quiz : data.worldcup;

                document.getElementById('edit-title').value = item.title;

                // Extract description and hashtags
                let desc = item.description || '';
                const tagMatch = desc.match(/\[HASHTAGS:(.*?)\]/);
                if (tagMatch) {
                    hashtags = tagMatch[1].split(',').filter(t => t.trim() !== '');
                    desc = desc.replace(tagMatch[0], '').trim();
                    renderHashtags();
                }
                document.getElementById('edit-description').value = desc;

                document.getElementById('edit-thumbnail').value = item.thumbnail_url || '';
                if (item.thumbnail_url) {
                    const dropZone = document.getElementById('thumb-drop-zone');
                    let thumbElement = dropZone.querySelector('.drop-zone__thumb');
                    if (!thumbElement) {
                        thumbElement = document.createElement('div');
                        thumbElement.className = 'drop-zone__thumb';
                        dropZone.appendChild(thumbElement);
                    }
                    thumbElement.style.backgroundImage = `url('${item.thumbnail_url}')`;
                }
            }
        } catch (err) {
            console.error("Fetch detail error:", err);
        }
    }
});
