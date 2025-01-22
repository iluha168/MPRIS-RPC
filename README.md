# MPRIS-RPC

### A connector between Chromium-based browsers and Discord's RPC (or arRPC) using MPRIS.

This project displays activity status of your Discord user to whatever music you are listening in a browser, music being any media that has a square thumbnail.

## Setup instructions

*Warning:* this project uses your account token to upload images to Discord. **Self-botting is against Discord ToS**, and I will not be responsible for any accounts banned.

### Install dependencies
- `playerctl` - used as a connector to MPRIS.
- Run `deno install` to download *most* of JS libraries ahead of time.

### Create a Discord Application
- Go to https://discord.com/developers/applications and create an application. The application name will be shown in your profile when listening to music.
- Open file `template.env` in this repository and follow instructions there.
- Visit "Rich Presence" tab of your new application and upload images with the following names:
    - `playing` - music is playing;
    - `paused` - the player is paused;
    - `stopped` - the player has finished;
    - `default` - default album thumbnail.

### Run the script
Execute `deno run -A index.mts` in the current directory.