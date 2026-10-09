
document.addEventListener("DOMContentLoaded", () => {
    const telegram = window.Telegram?.WebApp;

    const statusElement = document.getElementById("connection-status");
    const welcomeTitle = document.getElementById("welcome-title");
    const avatar = document.getElementById("avatar");

    // Инициализация Mini App внутри Telegram
    if (telegram) {
        telegram.ready();
        telegram.expand();

        const user = telegram.initDataUnsafe?.user;

        if (user) {
            const firstName = user.first_name || "Сотрудник";
            welcomeTitle.textContent = `Привет, ${firstName}!`;

            const initials = [
                user.first_name,
                user.last_name
            ]
                .filter(Boolean)
                .map(name => name[0])
                .join("");

            avatar.textContent = initials || "Т";

            statusElement.textContent =
                telegram.initData
                    ? "Telegram подключён"
                    : "Ожидается авторизация Telegram";
        } else {
            statusElement.textContent =
                "Открой приложение через Telegram";
        }
    } else {
        statusElement.textContent =
            "Открой приложение внутри Telegram";
    }

    const actionMessages = {
        deal: "Создание сделки подключим следующим этапом.",
        deposits: "Раздел задатков подключим следующим этапом.",
        results: "Здесь появятся твои реальные результаты.",
        rating: "Рейтинг агентов подключим следующим этапом."
    };

    document.querySelectorAll("[data-action]").forEach(button => {
        button.addEventListener("click", () => {
            const action = button.dataset.action;
            alert(actionMessages[action] || "Раздел в разработке.");
        });
    });

    const tabNames = {
        home: "Главная",
        deals: "Сделки",
        rating: "Рейтинг",
        profile: "Профиль"
    };

    document.querySelectorAll("[data-tab]").forEach(button => {
        button.addEventListener("click", () => {
            document.querySelectorAll("[data-tab]").forEach(item => {
                item.classList.remove("active");
            });

            button.classList.add("active");

            const tab = button.dataset.tab;

            if (tab === "deals") {
                document.getElementById("deals-section")
                    ?.scrollIntoView({ behavior: "smooth" });
            } else if (tab !== "home") {
                alert(
                    `Раздел «${tabNames[tab] || tab}» подключим следующим этапом.`
                );
            } else {
                window.scrollTo({ top: 0, behavior: "smooth" });
            }
        });
    });
});
