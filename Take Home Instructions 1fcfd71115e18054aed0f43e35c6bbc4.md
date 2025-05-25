# Take Home Instructions

Take-at-Home Task - Frontend Engineer (KB

Congrats on making it thus far in the interview process for [Stack AI](https://stack.ai/)!

Here is a **2-day task** for you to show us where you shine the most 🙂

## 🥅 Goal

The goal of this task is to build a custom File Picker, similar to the one below, for a Google Drive connection:

![image.png](Take%20Home%20Instructions%201fcfd71115e18054aed0f43e35c6bbc4/image.png)

- The functionality should be very similar to the one in your computer to manage your filesystem (e.g. Finder on MacOS). Here are some of the actions you need to perform:
    - **Read**: read the files and folders from the database that are in the Google Drive connection:
        - Mind that this is like the same functionality as in `ls` in your terminal, meaning, the API is done so that you have to specify which “folder” you want to read, and list the subsequent files/folders.
    - **Delete**: the ability to remove a file from the list of files indexed (mind that this does NOT delete the file in Google Drive, but instead stops listing it as indexed).
    - **Create/Update**: you do **not** need to perform these actions.
- Now, there is one more thing! The File Picker is meant to be used for picking and INDEXING files to build Knowledge Bases (see API docs below) of a subset of files/folders, and as such, we want the user to be able to:
    - Select a file/folder and index it (see API endpoints in jupyter notebook below).
    - Provide information about whether the file has been indexed or not.
    - Allow the user to de-index a file (without necessarily deleting the file), and show the user when the file has been de-index.
- Bonus points:
    - Sorting:
        - By name
        - By date
    - Filtering:
        - By name
    - Searching:
        - By name

## 📔 Resources:

- Here is a jupyter notebook for you to see how to use the API endpoints:
    - To run and visualize this notebook in VSCode: install Jupyter Notebook extension.
    
    [Knowledge_Base_Workflow_(5).ipynb](Take%20Home%20Instructions%201fcfd71115e18054aed0f43e35c6bbc4/Knowledge_Base_Workflow_(5).ipynb)
    
- Credentials to log into Google Drive, and to log into Stack AI.
- You will be asked for the password below inside the jupyter notebook:
    - Email: [stackaitest@gmail.com](mailto:stackaitest@gmail.com)
    - Password: !z4ZnxkyLYs#vR

These are used for:

- Logging into Google Drive
- Accessing a StackAI account created for this task, with a Google Drive connection already created.

> ⚠️ If you are asked for two factor authentication. Ping arosinol@stack-ai.com (+18575295760, whatsapp/sms works)and your point of contact at Stack AI.
> 

## ⚒️ **Tech Stack**

- **Framework**: React + Next.js (latest stable version)
- **Data Fetching**: Tanstack Query or [SWR](https://swr.vercel.app/) + fetch
- **State Management**: Zustand (if really needed)
- **Styling**: Tailwind CSS (latest stable version)
- **Components library**: [Shadcn](https://ui.shadcn.com/) (ensure compatibility with the latest Next.js version)

## 📓 Evaluation Criteria

We will look at the code and UI/UX's quality.

🎼 **Code quality:**

- Reusing components
- Use of custom hooks
- [SOLID design principles](https://medium.com/byborg-engineering/applying-solid-to-react-ca6d1ff926a4)
- Use of comments wherever necessary
- Proper typing of variables
- React good practices
- Proper use of `useEffect`
- Minimizing unnecessary re-renders.
- Next.js good practices

🖥️ **UI/UX quality:**

- Does everything work as expected? Are there any console errors or broken features?
- Is it fast? Do you have to wait for the UI? Does it make good use of optimistic updates?
- Is it intuitive?
- Does it look visually appealing?
- Low Cumulative Layout Shift? Do things move around when clicking something (this is bad)? [Learn more about CLS](https://vercel.com/docs/speed-insights/metrics#cumulative-layout-shift-cls)

## 🔖 Deliverable

1. **Source Code**: A link to a GitHub repository containing all your source code.
2. **Live Demo**: A link to a live demo of the page **hosted on Vercel.**
    1. **Demo video**: a screen recording of your design with an explanation of your design choices and thoughts/problem-solving.
    2. **Website link**: to a Vercel-hosted website
3. **Documentation**: A README file that explains your technical choices, how to run the project locally, and any other relevant information.

## 🕰️ Timeline

You have **2 days** (48h) from the receipt of this test to submit your deliverables 🚀