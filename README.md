# Stremio Real Debrid Addon

Stream your Real Debrid files in Stremio

## Tailwind CSS Setup

## Compiling Tailwind CSS Assets

To compile the Tailwind CSS assets in your project, run the following command:

```bash
npx tailwindcss -i ./src/main.css -o ./dist/main.css --minify
```

This will take the `main.css` file located in the `src` directory, process it with Tailwind CSS, and output the minified result to the `dist` directory.

## Watching for Changes in Real-Time

If you want to make changes to your Tailwind CSS files and see the results in real-time during local development, run the following command:

```bash
npx tailwindcss -i ./src/main.css -o ./dist/main.css --watch
```

This command will watch for any changes in the `main.css` file and recompile the output file automatically whenever a change is detected.

## Prerequisites

Ensure that you have Node.js and npm installed on your machine. You can install Tailwind CSS via npm if you haven't done so already:

```bash
npm install
```

For more information, refer to the [Tailwind CSS documentation](https://tailwindcss.com/docs/installation).
