<!-- App.svelte -->
<script>
  import { onMount } from "svelte";
  import Tab from "./components/Tab.svelte";
  import Background from "./components/Background.svelte";
  import tabsData from "./tabsData.json"; // Import the JSON data directly

  let tabs = tabsData;
  let background = "";
  let videoSrc = "";
  let clickedTab = tabs[0];

  onMount(() => {
    background = tabs[0]?.background || "";
    videoSrc = tabs[0]?.videoSrc || "";
  });

  function handleTabClick(event) {
    clickedTab = tabs.find((tab) => tab.id === event.detail);

    console.log("clickedTab ", clickedTab);

    if (clickedTab) {
      background = clickedTab.background;
      videoSrc = clickedTab.videoSrc;
    }
  }
</script>

<div class="app">
  <Background {background} {videoSrc} />
  <h1 class="title">AtomoSphere</h1>

  <div class="tabs">
    {#each tabs as tab (tab.id)}
      <Tab
        {tab}
        id={tab.id}
        active={clickedTab.id === tab.id}
        on:tabclick={handleTabClick}
      />
    {/each}
  </div>
</div>

<style>
  .app {
    width: 100%;
    height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;

    background-size: cover;
    background-position: center;
  }

  .title {
    font-family: "Poppins", Arial, sans-serif;
    font-size: 3em;
    color: white;
    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
    margin-bottom: 2em;
    z-index: 2;
  }

  .tabs {
    display: flex;
    justify-content: space-around;
    flex-wrap: wrap;
    width: 100%;
    gap: 32px;
    padding: 72px 32px;
    position: relative;
    box-sizing: border-box;
    z-index: 2;
  }

  .video-background {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    z-index: -1;
  }
</style>
