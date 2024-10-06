module.exports = {
    content: ["./*.{html,js}"],
    theme: {
        extend: {
            fontFamily: {
                sans: ["Maven Pro", "sans-serif"],
                display: ["Maven Pro", "sans-serif"],
                body: ["Maven Pro", "sans-serif"],
            },
        },
    },
    plugins: [require("@tailwindcss/forms")],
};
