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

        const user = telegram.initDataUnsafe?.user;

        if (user) {
            welcomeTitle.textContent =
                `Привет, ${user.first_name || "Сотрудник"}!`;

            avatar.textContent = [
                user.first_name,
                user.last_name
            ]
                .filter(Boolean)
                .map((name) => name[0])
                .join("") || "Т";
        }
    }

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
                "Комиссия: " + money(deal.commission);

            card.append(title, status, commission);

            if (deal.is_joint_deal) {
                const joint = document.createElement("p");
                joint.textContent =
                    "Совместная сделка — показана половина комиссии";
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

    async function loadData() {
        if (!telegram?.initData) {
            statusElement.textContent =
                "Открой приложение через Telegram для авторизации";

            showMessage("Нет данных авторизации Telegram");
            return;
        }

        statusElement.textContent = "Загружаем данные...";

        try {
            const response = await fetch(`${API_URL}/api/me`, {
                method: "GET",
                headers: {
                    "X-Telegram-Init-Data": telegram.initData
                }
            });

            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error(
                        "Не удалось проверить авторизацию Telegram"
                    );
                }

                if (response.status === 403) {
                    throw new Error(
                        "Твой Telegram не найден среди активных сотрудников"
                    );
                }

                throw new Error(`Ошибка API: ${response.status}`);
            }

            const data = await response.json();
            const employee = data.employee;
            const deals = Array.isArray(data.deals) ? data.deals : [];

            welcomeTitle.textContent =
                `Привет, ${employee.full_name || "Сотрудник"}!`;

            const initials = (employee.full_name || "Т")
                .split(/\s+/)
                .filter(Boolean)
                .map((part) => part[0])
                .slice(0, 2)
                .join("");

            avatar.textContent = initials || "Т";

            const now = new Date();

            const currentMonth =
                `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

            const completedDeals = deals.filter((deal) =>
                ["approved", "paid"].includes(deal.status)
            );

            const monthlyDeals = completedDeals.filter((deal) =>
                (deal.deal_month || deal.deal_date || "")
                    .startsWith(currentMonth)
            );

            // Берём комиссию, подготовленную API:
            // полную для обычной сделки и половину для совместной.
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

            progressFill.style.width =
                `${Math.min(percent, 100)}%`;

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

    const actionMessages = {
        deal: "Создание сделки подключим следующим этапом.",
        deposits: "Раздел задатков подключим следующим этапом.",
        results: "Подробную статистику подключим следующим этапом.",
        rating: "Рейтинг агентов подключим следующим этапом."
    };

    document.querySelectorAll("[data-action]").forEach((button) => {
        button.addEventListener("click", () => {
            alert(
                actionMessages[button.dataset.action] ||
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
