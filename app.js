document.addEventListener("DOMContentLoaded", () => {
    const actionMessages = {
        deal: "Создание сделки подключим следующим этапом.",
        deposits: "Раздел задатков подключим следующим этапом.",
        results: "Здесь появятся твои реальные результаты.",
        rating: "Рейтинг агентов подключим к данным бота."
    };

    document.querySelectorAll("[data-action]").forEach((button) => {
        button.addEventListener("click", () => {
            const action = button.dataset.action;
            alert(actionMessages[action] || "Раздел пока в разработке.");
        });
    });

    document.querySelectorAll("[data-tab]").forEach((button) => {
        button.addEventListener("click", () => {
            document.querySelectorAll("[data-tab]").forEach((item) => {
                item.classList.remove("active");
            });

            button.classList.add("active");

            const tabNames = {
                home: "Главная",
                deals: "Сделки",
                rating: "Рейтинг",
                profile: "Профиль"
            };

            if (button.dataset.tab !== "home") {
                alert(
                    "Раздел «" +
                    tabNames[button.dataset.tab] +
                    "» подключим следующим этапом."
                );
            }
        });
    });
});

