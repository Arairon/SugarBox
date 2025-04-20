# SugarBox - SugarCube Save Manager

## Overview

SugarBox is a chrome extension designed for managing saves from SugarCube games. This tool allows you to have all your save files in one convenient location with a single ui. It also offers synchronization to a cloud server, which you can host yourself (or use the default one for free)

> [!note]
> The main purpose of this project was for me to tinker with react and typescript, so don't expect enterprise level code :)
>
> If you'd like to contribute or have any ideas, questions or bug reports - feel free to contact me.
>
> I am by no means a designer, so if you've got a better icon in mind for this, please contact me.

## Cloud Accounts Warning

> [!warning]
> Do **NOT** create more than one account if you have anything in your local database.

Each game/char/save has their own UUID. When you log into one account, everything is uploaded and tied to that account.

If you log in with another account, the extension will try to upload already uploaded data to another account, which will conflict with the older versions.

If you **really** need to, you can log out from one account, delete the local database and then log into the new one.

## Firefox support

> [!warning]
> This extension does not support firefox based browsers.

As a chromium hater myself i am also sad about this, but there's not much i can do without rewriting a ton. First of all, there are a lot more security features and i am not quite ready to fight with firefox to allow my extension to communicate save data between a popup and a content script. Secondly, firefox popups try to close on the slightest click, so for example DB import from file will not work, since by the time you've selected the file, the popup is already closed.

## Installation

I would love to tell you that i managed to upload this extension to chrome's store, but unfortunately i am unable to for regional reasons.

For now you can use the unpacked version

1. Download the extension from the releases page (or build one yourself)
2. Head to chrome's [extension menu](chrome://extensions/)
3. Enable developer mode in the top right corner
4. Click "Load unpacked" in the top left corner
5. Select the extension folder, which includes "manifest.json" file

> [!note]
> If you fear that i've packed something malicious into the extension, then feel free to review the code and/or build a version of the extension yourself

## Running your own server

If you choose to run your own server, you can do so with docker

```yaml
services:
  sugarbox:
    image: ... # will be updated when i set up github actions
    restart: unless-stopped
    container_name: sugarbox-server
    ports:
      - 3000:3000
    volumes:
      - ./db:/app/db 
      - ./log:/app/log # optional
    environment: # See .env.example in /server
      AUTH_SECRET: "" # A long, random string. Not optional
      LOG_LEVEL: info
      ACCESS_TOKEN_LIFESPAN: "5m" # Uses npm vercel/ms format. Should be relatively low.
      REFRESH_TOKEN_LIFESPAN: "60d" # How long can a user stay logged in for without opening the app
      STORAGE_QUOTA_USER: 104857600 #100mb. Yes it's technically mib. Blame windows
      STORAGE_QUOTA_ADMIN: 1073741824 #1gb
      REGISTERED_USERS_LIMITED: false # Makes newly registered users 'limited'
```

## Building from source

### Prerequisites

1. **Node.js**: Ensure you have Node.js installed. You can download it from [Node.js official website](https://nodejs.org/).
2. **pnpm**: Install pnpm, the package manager used in this project. Run the following command to install it globally: `npm install -g pnpm`
3. Clone the repo `git clone https://github.com/arairon/sugarcube`

### Extension

1. Navigate to extension/popup/ `cd extension/popup`
2. Install dependencies `pnpm i`
3. Navigate back to the extension/ folder `cd ..`
4. Run the build script `./extension-dist.sh` (or .bat)
5. The extension is now located in the project's root's dist/ directory

#### Dev build

If you just want the dev build, then all you need to do is:

1. Navigate to extension/popup `cd extension/popup`
2. Install dependencies `pnpm i`
3. Run `pnpm dev` or `pnpm dev:live`
4. Load the extension/manifest.json file in chrome

### Server

1. Navigate to server/ directory `cd server`
2. Install dependencies `pnpm i`
3. Run the server `pnpm dev`
4. (optional) Build a container `docker build -t sugarbox-server .`

## Interface

### Saves

![SaveSlotsImage](/docs/img/slots.png)

These are saves for 'Character A' in game 'Degrees Of Ledity'.
You can create as many slots as you want.

![ExtraSaveInfoImage](/docs/img/extrasaveinfo.png)

You can also view extra info about a save and export it to a file, which is compatible with SugarCube's import system.
There are also a few technical details if you want them.

![SaveListImage](/docs/img/saveslist.png)

You can also view all saves for a certain game, including the archived saves. And you can load them or restore them if you choose to do so.

> [!note]
> Since saves are mostly quite small in size and this extension lets you store as many as your file system allows,
> I've decided to go with an 'archive first' approach. Every deletion just marks that game/character/save as 'archived', which you can restore later.
>
> (Of course you can delete archived objects in the cleanup menu. See [Utilities](#utilities))

### Games

![GameListImage](/docs/img/gameslist.png)

The games list is quite basic. You can add as many games as you want and also edit them.

![GamePathsImage](/docs/img/gamepaths.png)

You can assign as many 'paths' to a game as you want, as long as they don't conflict with other games.
When you open the extension, it will select a game base on the current browser tab's url.

![GameLaunchImage](/docs/img/gamelaunch.png)

If the current browser tab is not registered as a game, you can manually select one from the list, by clicking the arrow button and then launch it. Based on whether the game has one or more paths, the extension will ask you which one you'd like to open

### Utilities

![UtilsPageImage](/docs/img/utilspage.png)

In the utils page (the wrench in the bottom right) you can see how much space is currently taken and how much is available, which is most likely equal to the free space on your drive.

Here you can check the integrity of the current database. Back it up to a file or restore from one, or just delete it as a whole.

You can also clean up older archived items if you are sure you won't need them

![UtilsPage2Image](/docs/img/utilspage2.png)

A bit lower you can find the amount of storage you take up on the cloud server. The quota is configurable by the server's admin (and isn't currently enforcable, which i hopefully will change soon)

You can also manually trigger sync or change the server's url to a different one.

### Account

![AccountPageImage](/docs/img/accountpage.png)

You can also manage your account and sessions.
Invalidating a session will not log you out immediately, but will prevent refreshing a token, which will log you out in the next 5 minutes or less (depending on the server's accesstoken lifespan, default is 5m)

## Tested Games

> Yes, they are, indeed, porn.

- Degrees of Lewdity (including dolmods)
- Course of Temptation
- Secretary
- The Princess Trap
- Animus non grata
- Becoming the prom queen
- New Life Project
- In Her Own Hands
- Paradise Inc.
- Cambion
- (+ about 10 more)
