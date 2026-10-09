
document.addEventListener("DOMContentLoaded", async () => {
    const API_URL =
        "https://authentic-animated-fan-camcorder.trycloudflare.com";

    const telegram = window.Telegram?.WebApp;
    const $ = (id) => document.getElementById(id);

    const statusElement = $("connection-status");
    const welcomeTitle = $("welcome-title");
    const avatar = $("avatar");
    const incomeElement = $("income");
    const incomeNote = $("income-note");
    const planPercent = $("plan-percent");
    const planNote = $("plan-note");
    const progressFill = $("progress-fill");
    const dealsCount = $("deals-count");
    const dealsList = $("deals-list");

    const money = (value) =>
        new Intl.NumberFormat("ru-RU", {
            maximumFractionDigits: 0
        }).format(Number(value) || 0) + " ₽";

    if (telegram) {
        telegram.ready();
        telegram.expand();
    }

    const telegramUser = telegram?.initDataUnsafe?.user;

    if (telegramUser) {
        welcomeTitle.textContent =
            `Привет, ${telegramUser.first_name || "Сотрудник"}!`;

        avatar.textContent = [
            telegramUser.first_name,
            telegramUser.last_name
        ]
            .filter(Boolean)
            .map((name) => name[0])
            .join("") || "Т";
    }

    let employeeData = null;
    let isSubmitting = false;

    function showMessage(message) {
        dealsList.replaceChildren();

        const card = document.createElement("div");
        card.className = "empty-card";

        const title = document.createElement("strong");
        title.textContent = message;

        card.appendChild(title);
        dealsList.appendChild(card);
    }

    function renderDeals(deals) {
        dealsList.replaceChildren();
        dealsCount.textContent = String(deals.length);

        if (!deals.length) {
            showMessage("Сделок пока нет");
            return;
        }

        const statusLabels = {
            draft: "Черновик",
            pending_review: "На проверке",
            approved: "Подтверждена",
            rejected: "Отклонена",
            cancelled: "Отменена",
            paid: "Выплачена"
        };

        deals.forEach((deal) => {
            const card = document.createElement("div");
            card.className = "empty-card";

            const title = document.createElement("strong");
            title.textContent = deal.address || "Адрес не указан";

            const status = document.createElement("p");
            status.textContent =
                "Статус: " +
                (statusLabels[deal.status] || deal.status || "Не указан");

            const commission = document.createElement("p");
            commission.textContent =
                "Комиссия для участника: " + money(deal.commission);

            card.append(title, status, commission);

            if (deal.is_joint_deal) {
                const joint = document.createElement("p");
                joint.textContent =
                    "Совместная сделка — указана половина общей комиссии";
                card.appendChild(joint);
            }

            if (deal.deal_date) {
                const date = document.createElement("p");
                date.textContent =
                    "Дата: " + deal.deal_date.slice(0, 10);
                card.appendChild(date);
            }

            dealsList.appendChild(card);
        });
    }

    async function apiFetch(path, options = {}) {
        if (!telegram?.initData) {
            throw new Error(
                "Открой приложение через Telegram для авторизации."
            );
        }

        const headers = {
            "X-Telegram-Init-Data": telegram.initData,
            ...(options.body ? { "Content-Type": "application/json" } : {}),
            ...(options.headers || {})
        };

        const response = await fetch(`${API_URL}${path}`, {
            ...options,
            headers,
            cache: "no-store"
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(
                data.detail || `Ошибка сервера: ${response.status}`
            );
        }

        return data;
    }

    async function loadData() {
        if (!telegram?.initData) {
            statusElement.textContent =
                "Открой приложение через Telegram для авторизации";
            showMessage("Нет данных авторизации Telegram");
            return;
        }

        statusElement.textContent = "Загружаем данные...";

        try {
            const data = await apiFetch("/api/me");
            const employee = data.employee;
            const deals = Array.isArray(data.deals) ? data.deals : [];

            employeeData = employee;

            welcomeTitle.textContent =
                `Привет, ${employee.full_name || "Сотрудник"}!`;

            avatar.textContent = (employee.full_name || "Т")
                .split(/\s+/)
                .filter(Boolean)
                .map((part) => part[0])
                .slice(0, 2)
                .join("");

            const now = new Date();
            const currentMonth =
                `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

            const completedDeals = deals.filter((deal) =>
                ["approved", "paid"].includes(deal.status)
            );

            const monthlyDeals = completedDeals.filter((deal) => {
                const date = String(
                    deal.deal_month || deal.deal_date || ""
                );
                return date.startsWith(currentMonth);
            });

            const monthlyIncome = monthlyDeals.reduce(
                (sum, deal) =>
                    sum + (Number(deal.commission) || 0),
                0
            );

            const plan = Number(employee.monthly_plan) || 0;
            const percent = plan > 0
                ? Math.round(monthlyIncome / plan * 100)
                : 0;

            incomeElement.textContent = money(monthlyIncome);
            incomeNote.textContent =
                "Комиссия по подтверждённым сделкам за текущий месяц";

            planPercent.textContent = `${percent}%`;
            progressFill.style.width = `${Math.min(percent, 100)}%`;

            planNote.textContent = plan > 0
                ? `${money(monthlyIncome)} из ${money(plan)}`
                : "Месячный план не установлен в базе";

            statusElement.textContent =
                "Данные загружены из БотСделка";

            renderDeals(deals);

        } catch (error) {
            console.error("Ошибка загрузки данных:", error);

            statusElement.textContent =
                "Не удалось загрузить данные";

            incomeElement.textContent = "—";
            incomeNote.textContent = error.message;
            planPercent.textContent = "—";
            planNote.textContent = "Нет данных";
            progressFill.style.width = "0%";

            showMessage(error.message);
        }
    }

    // ========================================================
    // ФОРМА ДОБАВЛЕНИЯ СДЕЛКИ
    // ========================================================

    function installDealFormStyles() {
        if ($("deal-form-styles")) return;

        const style = document.createElement("style");
        style.id = "deal-form-styles";
        style.textContent = `
            .deal-modal-backdrop {
                position: fixed;
                inset: 0;
                z-index: 9999;
                background: rgba(0,0,0,.65);
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 14px;
                box-sizing: border-box;
            }
            .deal-modal {
                background: var(--tg-theme-bg-color, #fff);
                color: var(--tg-theme-text-color, #222);
                width: 100%;
                max-width: 480px;
                max-height: 90vh;
                overflow-y: auto;
                border-radius: 18px;
                padding: 20px;
                box-sizing: border-box;
                box-shadow: 0 10px 40px rgba(0,0,0,.25);
            }
            .deal-modal h2 {
                margin: 0 0 8px;
                font-size: 21px;
            }
            .deal-modal .deal-description {
                opacity: .75;
                font-size: 13px;
                margin-bottom: 18px;
                line-height: 1.45;
            }
            .deal-modal label {
                display: block;
                margin: 14px 0 6px;
                font-size: 14px;
                font-weight: 600;
            }
            .deal-modal input,
            .deal-modal select {
                display: block;
                width: 100%;
                min-height: 46px;
                box-sizing: border-box;
                border: 1px solid var(--tg-theme-hint-color, #aaa);
                border-radius: 10px;
                padding: 10px 12px;
                font-size: 16px;
                color: var(--tg-theme-text-color, #222);
                background: var(--tg-theme-secondary-bg-color, #f5f5f5);
            }
            .deal-joint-toggle {
                display: flex !important;
                align-items: center;
                gap: 10px;
                line-height: 1.4;
            }
            .deal-joint-toggle input {
                width: 20px;
                min-height: 20px;
                flex: 0 0 20px;
            }
            .deal-form-note {
                font-size: 12px;
                opacity: .75;
                line-height: 1.45;
                margin-top: 8px;
            }
            .deal-form-error {
                color: #d93025;
                font-size: 13px;
                margin-top: 12px;
                white-space: pre-wrap;
            }
            .deal-form-actions {
                display: flex;
                gap: 10px;
                margin-top: 20px;
            }
            .deal-form-actions button {
                flex: 1;
                min-height: 46px;
                border: 0;
                border-radius: 10px;
                font-size: 15px;
                font-weight: 600;
                cursor: pointer;
            }
            .deal-submit {
                background: var(--tg-theme-button-color, #c62828);
                color: var(--tg-theme-button-text-color, white);
            }
            .deal-cancel {
                background: var(--tg-theme-secondary-bg-color, #eee);
                color: var(--tg-theme-text-color, #222);
            }
            .deal-submit:disabled {
                opacity: .6;
                cursor: wait;
            }
        `;

        document.head.appendChild(style);
    }

    async function openDealForm() {
        if (!telegram?.initData) {
            alert("Открой приложение через Telegram.");
            return;
        }

        installDealFormStyles();

        const backdrop = document.createElement("div");
        backdrop.className = "deal-modal-backdrop";

        backdrop.innerHTML = `
            <section class="deal-modal" role="dialog"
                aria-modal="true" aria-labelledby="deal-form-title">
                <h2 id="deal-form-title">Добавить сделку</h2>
                <div class="deal-description">
                    Заполни данные объекта и общую комиссию.
                    После отправки сделка поступит руководителю на проверку.
                </div>

                <form id="new-deal-form">
                    <label for="deal-address">Адрес объекта *</label>
                    <input id="deal-address" name="object_address"
                        placeholder="Улица, дом, населённый пункт"
                        maxlength="500" required autocomplete="street-address">

                    <label for="deal-object-type">Вид объекта *</label>
                    <select id="deal-object-type" name="object_type" required>
                        <option value="">Выбери вид объекта</option>
                        <option value="Квартира">Квартира</option>
                        <option value="Дом">Дом</option>
                        <option value="Участок">Земельный участок</option>
                        <option value="Коммерческая недвижимость">Коммерческая недвижимость</option>
                        <option value="Новостройка">Новостройка</option>
                        <option value="Другое">Другое</option>
                    </select>

                    <label for="deal-commission">Общая комиссия, ₽ *</label>
                    <input id="deal-commission" name="gross_commission"
                        type="number" min="1" max="1000000000" step="0.01"
                        placeholder="Например, 200000" required>

                    <label class="deal-joint-toggle">
                        <input id="deal-is-joint" type="checkbox">
                        <span>Совместная сделка с другим агентом</span>
                    </label>

                    <div id="deal-second-employee-wrap" hidden>
                        <label for="deal-second-employee">Второй агент *</label>
                        <select id="deal-second-employee" name="second_employee_id">
                            <option value="">Загрузка сотрудников...</option>
                        </select>
                    </div>

                    <div class="deal-form-note">
                        Комиссия и стоимость юриста рассчитываются по правилам
                        БотСделка. Для совместной сделки суммы распределяются
                        между участниками согласно правилам системы.
                    </div>

                    <div id="deal-form-error" class="deal-form-error"
                        role="alert"></div>

                    <div class="deal-form-actions">
                        <button type="button" class="deal-cancel"
                            id="deal-form-cancel">Отмена</button>
                        <button type="submit" class="deal-submit"
                            id="deal-form-submit">Отправить заявку</button>
                    </div>
                </form>
            </section>
        `;

        document.body.appendChild(backdrop);

        const form = $("new-deal-form");
        const jointCheckbox = $("deal-is-joint");
        const secondWrap = $("deal-second-employee-wrap");
        const secondSelect = $("deal-second-employee");
        const submitButton = $("deal-form-submit");
        const errorElement = $("deal-form-error");

        function closeForm() {
            if (isSubmitting) return;
            backdrop.remove();
            document.removeEventListener("keydown", onEscape);
        }

        function onEscape(event) {
            if (event.key === "Escape") closeForm();
        }

        $("deal-form-cancel").addEventListener("click", closeForm);

        backdrop.addEventListener("click", (event) => {
            if (event.target === backdrop) closeForm();
        });

        document.addEventListener("keydown", onEscape);

        jointCheckbox.addEventListener("change", async () => {
            const joint = jointCheckbox.checked;
            secondWrap.hidden = !joint;
            secondSelect.required = joint;

            if (!joint) return;

            secondSelect.disabled = true;
            secondSelect.replaceChildren();

            const loadingOption = document.createElement("option");
            loadingOption.value = "";
            loadingOption.textContent = "Загрузка сотрудников...";
            secondSelect.appendChild(loadingOption);

            try {
                const data = await apiFetch("/api/employees");
                secondSelect.replaceChildren();

                const placeholder = document.createElement("option");
                placeholder.value = "";
                placeholder.textContent = "Выбери второго агента";
                secondSelect.appendChild(placeholder);

                (data.employees || []).forEach((employee) => {
                    const option = document.createElement("option");
                    option.value = String(employee.id);
                    option.textContent = employee.full_name;
                    secondSelect.appendChild(option);
                });

                if (!data.employees?.length) {
                    placeholder.textContent =
                        "Нет других активных сотрудников";
                }
            } catch (error) {
                secondSelect.replaceChildren();

                const option = document.createElement("option");
                option.value = "";
                option.textContent = "Не удалось загрузить сотрудников";
                secondSelect.appendChild(option);

                errorElement.textContent = error.message;
            } finally {
                secondSelect.disabled = false;
            }
        });

        form.addEventListener("submit", async (event) => {
            event.preventDefault();

            if (isSubmitting) return;

            errorElement.textContent = "";

            const address = $("deal-address").value.trim();
            const objectType = $("deal-object-type").value;
            const grossCommission = Number(
                $("deal-commission").value
            );
            const isJoint = jointCheckbox.checked;
            const secondEmployeeId = secondSelect.value;

            if (address.length < 3) {
                errorElement.textContent =
                    "Укажи корректный адрес объекта.";
                return;
            }

            if (!objectType) {
                errorElement.textContent =
                    "Выбери вид объекта.";
                return;
            }

            if (!Number.isFinite(grossCommission) || grossCommission <= 0) {
                errorElement.textContent =
                    "Укажи корректную сумму комиссии.";
                return;
            }

            if (isJoint && !secondEmployeeId) {
                errorElement.textContent =
                    "Выбери второго агента.";
                return;
            }

            const requestData = {
                object_address: address,
                object_type: objectType,
                gross_commission: grossCommission,
                is_joint_deal: isJoint,
                second_employee_id: isJoint
                    ? Number(secondEmployeeId)
                    : null
            };

            isSubmitting = true;
            submitButton.disabled = true;
            submitButton.textContent = "Отправляем...";
            $("deal-form-cancel").disabled = true;

            try {
                const result = await apiFetch("/api/deals", {
                    method: "POST",
                    body: JSON.stringify(requestData)
                });

                backdrop.remove();
                document.removeEventListener("keydown", onEscape);

                if (telegram?.HapticFeedback) {
                    telegram.HapticFeedback.notificationOccurred("success");
                }

                if (result.notification_sent) {
                    alert(
                        `Заявка №${result.deal_id} сохранена и отправлена руководителю на проверку.`
                    );
                } else {
                    alert(
                        `Заявка №${result.deal_id} сохранена, но уведомление руководителю не отправлено. Проверь Telegram и сервер API.`
                    );
                }

                await loadData();

            } catch (error) {
                console.error("Ошибка создания сделки:", error);
                errorElement.textContent = error.message;
                isSubmitting = false;
                submitButton.disabled = false;
                submitButton.textContent = "Отправить заявку";
                $("deal-form-cancel").disabled = false;
            }
        });

        $("deal-address").focus();
    }

    // ========================================================
    // КНОПКИ РАЗДЕЛОВ
    // ========================================================

// ========================================================
// ЗАДАТКИ: ФОРМА, СПИСОК И ПОДТВЕРЖДЕНИЕ
// ========================================================

async function openDepositsSection() {
    try {
        const data = await apiFetch("/api/deposits");
        const deposits = data.deposits || [];
        const isManager = Boolean(data.is_manager);

        installDealFormStyles();

        const backdrop = document.createElement("div");
        backdrop.className = "deal-modal-backdrop";

        backdrop.innerHTML = `
            <section class="deal-modal" role="dialog" aria-modal="true">
                <h2>💰 Задатки</h2>
                <p class="deal-description">
                    Подтверждённые задатки доступны всем агентам.
                    Твои заявки на проверке также будут отображаться здесь.
                </p>

                <button type="button" class="deal-submit"
                    id="deposit-new-button"
                    style="width:100%;min-height:46px;border:0;border-radius:10px">
                    + Новый задаток
                </button>

                <div id="deposit-list" style="margin-top:16px"></div>

                <div class="deal-form-actions">
                    <button type="button" class="deal-cancel"
                        id="deposit-close-button">Закрыть</button>
                </div>
            </section>
        `;

        document.body.appendChild(backdrop);

        const list = backdrop.querySelector("#deposit-list");

        function addText(parent, text, tag = "p") {
            const element = document.createElement(tag);
            element.textContent = text;
            parent.appendChild(element);
            return element;
        }

        function close() {
            backdrop.remove();
            document.removeEventListener("keydown", onEscape);
        }

        function onEscape(event) {
            if (event.key === "Escape") close();
        }

        backdrop.querySelector("#deposit-close-button")
            .addEventListener("click", close);

        backdrop.addEventListener("click", (event) => {
            if (event.target === backdrop) close();
        });

        document.addEventListener("keydown", onEscape);

        function renderDeposits() {
            list.replaceChildren();

            if (!deposits.length) {
                addText(list, "Задатков пока нет.");
                return;
            }

            deposits.forEach((deposit) => {
                const card = document.createElement("div");
                card.className = "empty-card";
                card.style.marginTop = "12px";

                addText(card, `Задаток №${deposit.id}`, "strong");
                addText(card, `Объект: ${deposit.object_address}`);
                addText(card, `Агент: ${deposit.agent_name}`);
                addText(card, `Покупатель: ${deposit.buyer_full_name || "—"}`);
                addText(card, `Телефон: ${deposit.buyer_phone || "—"}`);
                addText(card, `Сумма задатка: ${money(deposit.deposit_amount)}`);
                addText(card, `Дата оплаты: ${deposit.paid_at || "—"}`);
                addText(
                    card,
                    `Окончание: ${deposit.expires_at
                        ? deposit.expires_at.slice(0, 10)
                        : "—"}`
                );
                addText(card, `Статус: ${deposit.status}`);

                if (deposit.comment) {
                    addText(card, `Комментарий: ${deposit.comment}`);
                }

                if (deposit.rejection_reason) {
                    addText(
                        card,
                        `Причина отклонения: ${deposit.rejection_reason}`
                    );
                }

                if (isManager && deposit.status === "НА ПОДТВЕРЖДЕНИИ") {
                    const actions = document.createElement("div");
                    actions.className = "deal-form-actions";

                    const approve = document.createElement("button");
                    approve.className = "deal-submit";
                    approve.textContent = "Подтвердить";

                    const reject = document.createElement("button");
                    reject.className = "deal-cancel";
                    reject.textContent = "Отклонить";

                    approve.addEventListener("click", async () => {
                        await reviewDeposit(deposit.id, "approve");
                    });

                    reject.addEventListener("click", async () => {
                        const reason = prompt(
                            "Укажи причину отклонения заявки:"
                        );

                        if (reason === null) return;

                        if (!reason.trim()) {
                            alert("Нужно указать причину отклонения.");
                            return;
                        }

                        await reviewDeposit(
                            deposit.id,
                            "reject",
                            reason.trim()
                        );
                    });

                    actions.append(approve, reject);
                    card.appendChild(actions);
                }

                list.appendChild(card);
            });
        }

        async function reviewDeposit(id, action, rejectionReason = "") {
            try {
                const result = await apiFetch(
                    `/api/deposits/${id}/review`,
                    {
                        method: "POST",
                        body: JSON.stringify({
                            action,
                            rejection_reason: rejectionReason
                        })
                    }
                );

                const index = deposits.findIndex(
                    (item) => item.id === id
                );

                if (index !== -1) {
                    deposits[index] = result.deposit;
                }

                renderDeposits();

                alert(
                    action === "approve"
                        ? "Задаток подтверждён."
                        : "Заявка отклонена."
                );

                await loadData();

            } catch (error) {
                alert(`Не удалось обработать заявку: ${error.message}`);
            }
        }

        backdrop.querySelector("#deposit-new-button")
            .addEventListener("click", () => {
                openNewDepositForm(backdrop, close);
            });

        renderDeposits();

    } catch (error) {
        alert(`Не удалось загрузить задатки: ${error.message}`);
    }
}


async function openNewDepositForm(parentBackdrop, closeParent) {
    const backdrop = document.createElement("div");
    backdrop.className = "deal-modal-backdrop";
    backdrop.style.zIndex = "10001";

    const today = new Date();
    const todayString = [
        today.getFullYear(),
        String(today.getMonth() + 1).padStart(2, "0"),
        String(today.getDate()).padStart(2, "0")
    ].join("-");

    backdrop.innerHTML = `
        <section class="deal-modal" role="dialog" aria-modal="true">
            <h2>Новый задаток</h2>
            <p class="deal-description">
                После отправки заявка поступит руководителю на проверку.
            </p>

            <form id="new-deposit-form">
                <label for="dep-address">Адрес объекта *</label>
                <input id="dep-address" required minlength="3"
                    maxlength="500" placeholder="Адрес объекта">

                <label for="dep-buyer">ФИО покупателя *</label>
                <input id="dep-buyer" required minlength="2"
                    maxlength="200" placeholder="Фамилия Имя Отчество">

                <label for="dep-phone">Телефон покупателя *</label>
                <input id="dep-phone" type="tel" required minlength="5"
                    maxlength="50" placeholder="+7...">

                <label for="dep-amount">Сумма задатка, ₽ *</label>
                <input id="dep-amount" type="number" required min="0.01"
                    max="1000000000" step="0.01" placeholder="Например, 100000">

                <label for="dep-paid">Дата внесения задатка *</label>
                <input id="dep-paid" type="date" required value="${todayString}">

                <label for="dep-expires">Дата окончания задатка *</label>
                <input id="dep-expires" type="date" required>

                <label for="dep-type">Вид объекта</label>
                <select id="dep-type">
                    <option value="Квартира">Квартира</option>
                    <option value="Дом">Дом</option>
                    <option value="Земельный участок">Земельный участок</option>
                    <option value="Коммерческая недвижимость">Коммерческая недвижимость</option>
                    <option value="Новостройка">Новостройка</option>
                    <option value="Другое">Другое</option>
                </select>

                <label for="dep-comment">Комментарий</label>
                <input id="dep-comment" maxlength="2000"
                    placeholder="Дополнительная информация">

                <div id="dep-error" class="deal-form-error" role="alert"></div>

                <div class="deal-form-actions">
                    <button type="button" class="deal-cancel"
                        id="dep-cancel">Отмена</button>
                    <button type="submit" class="deal-submit"
                        id="dep-submit">Отправить заявку</button>
                </div>
            </form>
        </section>
    `;

    document.body.appendChild(backdrop);

    const form = backdrop.querySelector("#new-deposit-form");
    const errorElement = backdrop.querySelector("#dep-error");
    const submitButton = backdrop.querySelector("#dep-submit");
    const cancelButton = backdrop.querySelector("#dep-cancel");

    function closeForm() {
        backdrop.remove();
    }

    cancelButton.addEventListener("click", closeForm);

    backdrop.addEventListener("click", (event) => {
        if (event.target === backdrop) closeForm();
    });

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        errorElement.textContent = "";

        const paidAt = backdrop.querySelector("#dep-paid").value;
        const expiresAt = backdrop.querySelector("#dep-expires").value;
        const amount = Number(
            backdrop.querySelector("#dep-amount").value
        );

        if (!paidAt || !expiresAt) {
            errorElement.textContent = "Заполни обе даты.";
            return;
        }

        if (expiresAt < paidAt) {
            errorElement.textContent =
                "Дата окончания не может быть раньше даты оплаты.";
            return;
        }

        if (!Number.isFinite(amount) || amount <= 0) {
            errorElement.textContent = "Укажи корректную сумму задатка.";
            return;
        }

        const requestData = {
            object_address: backdrop.querySelector("#dep-address").value.trim(),
            buyer_full_name: backdrop.querySelector("#dep-buyer").value.trim(),
            buyer_phone: backdrop.querySelector("#dep-phone").value.trim(),
            deposit_amount: amount,
            paid_at: paidAt,
            expires_at: expiresAt,
            comment: backdrop.querySelector("#dep-comment").value.trim(),
            object_type: backdrop.querySelector("#dep-type").value,
            commission: 0,
            calculation_type: "Не указан"
        };

        submitButton.disabled = true;
        cancelButton.disabled = true;
        submitButton.textContent = "Отправляем...";

        try {
            const result = await apiFetch("/api/deposits", {
                method: "POST",
                body: JSON.stringify(requestData)
            });

            backdrop.remove();
            closeParent();

            alert(
                `Заявка на задаток №${result.deposit_id} отправлена.\n` +
                `Статус: ${result.status}.\n` +
                (
                    result.notification_sent
                        ? "Руководитель уведомлён."
                        : "Заявка сохранена, но уведомление руководителю не отправлено."
                )
            );

            await loadData();

        } catch (error) {
            errorElement.textContent = error.message;
            submitButton.disabled = false;
            cancelButton.disabled = false;
            submitButton.textContent = "Отправить заявку";
        }
    });
}

const actionMessages = {
    results: "Подробную статистику подключим следующим этапом.",
    rating: "Рейтинг агентов подключим следующим этапом."
};

    document.querySelectorAll("[data-action]").forEach((button) => {
        button.addEventListener("click", async () => {
            const action = button.dataset.action;

            if (action === "deal") {
                await openDealForm();
                return;
            }
if (action === "deposits") {
    await openDepositsSection();
    return;
}

            alert(
                actionMessages[action] ||
                "Раздел пока в разработке."
            );
        });
    });

    document.querySelectorAll("[data-tab]").forEach((button) => {
        button.addEventListener("click", () => {
            document.querySelectorAll("[data-tab]").forEach((item) => {
                item.classList.remove("active");
            });

            button.classList.add("active");

            if (button.dataset.tab === "deals") {
                $("deals-section")?.scrollIntoView({
                    behavior: "smooth"
                });
            } else if (button.dataset.tab === "home") {
                window.scrollTo({
                    top: 0,
                    behavior: "smooth"
                });
            } else {
                alert("Этот раздел подключим следующим этапом.");
            }
        });
    });

    await loadData();
});
