# SugarBox - SugarCube Save Manager

## Overview

[![server:release](https://github.com/Arairon/SugarBox/actions/workflows/server-container-release.yml/badge.svg)](https://github.com/Arairon/SugarBox/actions/workflows/server-container-release.yml)
[![server:main](https://github.com/Arairon/SugarBox/actions/workflows/server-container-main.yml/badge.svg)](https://github.com/Arairon/SugarBox/actions/workflows/server-container-main.yml)
[![server:dev](https://github.com/Arairon/SugarBox/actions/workflows/server-container-dev.yml/badge.svg)](https://github.com/Arairon/SugarBox/actions/workflows/server-container-dev.yml)

SugarBox is a chrome extension designed for managing saves from SugarCube games. This tool allows you to manage all your save files in one convenient location through a single UI. It also offers synchronization to a cloud server, which you can host yourself (or use the default one for free)

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

If you log in with another account, the extension will attempt to upload data that has already been uploaded, causing conflicts with older versions. It should not affect anything on the first account, but will cause errors for the second one.

If you **really** need to, you can log out from one account, delete the local database and then log into the new one.

## Firefox support

> [!warning]
> This extension does not support firefox based browsers yet.

As a chromium hater myself i am also sad about this, but there's not much i can do without rewriting a ton. First of all, there are a lot more security features and i am not quite ready to fight with firefox to allow my extension to communicate save data between a popup and a content script. Secondly, firefox popups try to close on the slightest click, so, for example, DB import from file will not work, since by the time you've selected the file, the popup is already gone.

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
    image: ghcr.io/arairon/sugarbox:latest
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
      STORAGE_QUOTA_USER: 250000000 # 250mb
      STORAGE_QUOTA_ADMIN: 1000000000 # 1gb
      REGISTERED_USERS_LIMITED: false # Makes newly registered users 'limited'
```

## Building from source

### Prerequisites

1. **Bun**: Ensure you have Bun installed. You can grab it from [Bun's website](https://bun.com).
2. Clone the repo `git clone https://github.com/arairon/sugarbox`

### Extension

1. Navigate to the extension package `cd packages/extension`
2. Install dependencies `bun i`
3. Run the build script `bun run build`
4. The extension is now located in dist/ directory

#### Dev build

If you just want the dev build, then all you need to do is run `bun dev` instead

### Server

1. Navigate to the server package `cd packages/server`
2. Install dependencies `bun i`
3. Run the server `bun dev`
4. (optional) Build a container `bun run build:container`

## Interface

### Saves

> [!note]
> UI has changed a bit, so images somewhat outdated. Though they are close enough for now

![SaveSlotsImage](/docs/img/slots.png)

These are saves for 'Character A' in game 'Degrees Of Lewdity'.
You can create as many slots as you want.

![ExtraSaveInfoImage](/docs/img/extrasaveinfo.png)

You can also view extra info about a save and export it to a file, which is compatible with SugarCube's import system.
There are also a few technical details if you want them.

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
When you open the extension, it will select a game based on the current browser tab's url.

![GameLaunchImage](/docs/img/gamelaunch.png)

If the current browser tab is not registered as a game, you can manually select one from the list, by clicking the arrow button and then launch it. Based on whether the game has one or more paths, the extension will ask you which one you'd like to open

### Utilities

![UtilsPageImage](/docs/img/utilspage.png)

In the utililities page (the wrench in the bottom right) you can see how much space is currently taken and how much is available, which is most likely equal to the free space on your drive.

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
