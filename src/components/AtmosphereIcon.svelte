<script>
  export let scene;
  export let active = false;
</script>

<span class="scene-icon" class:active class:rain={scene === "tab_rain"} class:coffee={scene === "tab_coffee_shop"} class:waterfall={scene === "tab_waterfall"} class:lightning={scene === "tab_lightning"} class:wind={scene === "tab_wind"} class:fire={scene === "tab_fire"} class:snow={scene === "tab_snow"} class:street={scene === "tab_street"} class:leaves={scene === "tab_leaves"} class:ocean={scene === "tab_ocean_waves"} class:train={scene === "tab_train"} class:typing={scene === "tab_typing"} class:footsteps={scene === "tab_foot_steps"} class:birds={scene === "tab_birds"} class:static={scene === "tab_white_noise"} class:onsen={scene === "tab_onsen"} class:cat={scene === "tab_cat_window"} class:library={scene === "tab_library"} class:forest={scene === "tab_forest"} class:jungle={scene === "tab_jungle"} class:shore={scene === "tab_beach_shore"} class:city={scene === "tab_traffic"} class:elevator={scene === "tab_elevator_music"} class:bedroom={scene === "tab_rainy_bedroom"} class:brown={scene === "tab_brown_noise"} class:space={scene === "tab_space_observation"} class:nightdrive={scene === "tab_night_drive"} class:apartment={scene === "tab_city_apartment"} class:farm={scene === "tab_farm"} aria-hidden="true">
  <svg viewBox="0 0 24 24">
    {#if scene === "tab_rain"}
      <path d="M6.5 15.5h10.3a3.2 3.2 0 0 0 .2-6.4 5.2 5.2 0 0 0-9.8 1.1 2.7 2.7 0 0 0-.7 5.3Z" />
      <path class="drop drop-a" d="m8 18-.8 2" /><path class="drop drop-b" d="m12 18-.8 2" /><path class="drop drop-c" d="m16 18-.8 2" />
    {:else if scene === "tab_coffee_shop"}
      <path d="M6 10h10v5.4A3.6 3.6 0 0 1 12.4 19H9.6A3.6 3.6 0 0 1 6 15.4V10Z" /><path d="M16 12h1.3a2.2 2.2 0 0 1 0 4.4H16" /><path d="M5 20h13" />
      <path class="steam steam-a" d="M9 8c-1-1 .8-1.8 0-3" /><path class="steam steam-b" d="M13 8c-1-1 .8-1.8 0-3" />
    {:else if scene === "tab_waterfall"}
      <path d="M5 4h14M7 4v5c0 2.5 1 4.1 1 6.5M12 4v7c0 2-.7 3.1-.7 5.5M17 4v5.5c0 2.2-1.2 4-1.2 6" />
      <path class="fall fall-a" d="M9.3 5v8" /><path class="fall fall-b" d="M14.5 6v8" /><path d="M4 19c2-1.4 4-.1 6-.1s4-1.3 6 0 3 .2 4-.3" />
    {:else if scene === "tab_lightning"}
      <path d="M6 14h10.8a3.2 3.2 0 0 0 .2-6.4 5.2 5.2 0 0 0-9.8 1.1A2.7 2.7 0 0 0 6 14Z" />
      <path class="bolt" d="m12.4 14-2.2 4h2l-1 3 4.1-5h-2l1.2-2" />
    {:else if scene === "tab_wind"}
      <path class="gust gust-a" d="M4 8h10.5c3 0 3-4 0-4-1.1 0-1.8.5-2.2 1.2" /><path class="gust gust-b" d="M3 12h15c3.5 0 3.5 4.5.2 4.5-1.3 0-2-.6-2.4-1.5" /><path class="gust gust-c" d="M5 16h6" />
    {:else if scene === "tab_fire"}
      <path class="flame flame-outer" d="M12 21c-4.2 0-7-2.8-7-6.7 0-3.4 2.4-5.2 4.7-8.4.2 2.2 1.1 3.3 2.1 3.9 1.1-2 2.5-3.4 2.3-6.8 3.3 2.8 5 6.3 5 10.3C19 17.8 16.2 21 12 21Z" /><path class="flame flame-inner" d="M12 19c-2 0-3.3-1.4-3.3-3.3 0-1.7 1.1-2.8 2.4-4.4.1 1.2.7 2 1.3 2.4.5-1 1.4-1.9 1.5-3.2 1.2 1.5 1.8 3.1 1.7 4.8 0 2.2-1.5 3.7-3.6 3.7Z" />
    {:else if scene === "tab_snow"}
      <g class="snowflake"><path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9" /><path d="m9.8 5.3 2.2 2.2 2.2-2.2M9.8 18.7l2.2-2.2 2.2 2.2M5.3 10l3-.8-.8-3M18.7 14l-3 .8.8 3M5.3 14l3 .8-.8 3M18.7 10l-3-.8.8-3" /></g>
    {:else if scene === "tab_street"}
      <path d="M6 21V8.5A3.5 3.5 0 0 1 9.5 5H14" /><path d="M14 4h4v5h-4zM4 21h6M16 11v10" /><circle class="lamp-glow" cx="16" cy="6.5" r="1.2" /><path class="moon" d="M8 3.5a3 3 0 0 0 3.5 3.6A3.5 3.5 0 1 1 8 3.5Z" />
    {:else if scene === "tab_leaves"}
      <g class="leaf-sway"><path d="M12 20V8" /><path d="M12 12C7 12 5 9 5 5c4 0 7 1.7 7 7ZM12 15c4.8 0 7-2.5 7-6.2-4 0-7 1.6-7 6.2Z" /></g>
    {:else if scene === "tab_ocean_waves"}
      <path class="wave wave-a" d="M3 9c2.3 0 2.3-1.8 4.6-1.8S10 9 12.3 9s2.3-1.8 4.6-1.8S19.2 9 21.5 9" /><path class="wave wave-b" d="M2.5 14c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2" /><path class="wave wave-c" d="M4 18c2 0 2-1.4 4-1.4s2 1.4 4 1.4 2-1.4 4-1.4 2 1.4 4 1.4" />
    {:else if scene === "tab_train"}
      <path d="M7 3h10a2 2 0 0 1 2 2v11a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V5a2 2 0 0 1 2-2Z" /><path d="M7 6h10v6H7zM8 16h.1M16 16h.1M8 19l-2 2M16 19l2 2" /><path class="rail" d="M9 21h6" />
    {:else if scene === "tab_typing"}
      <rect x="3" y="6" width="18" height="12" rx="2" /><path d="M6 9h2M11 9h2M16 9h2M6 12h2M11 12h2M16 12h2M7 15h10" /><path class="key-tap key-a" d="M6 9h2" /><path class="key-tap key-b" d="M11 12h2" />
    {:else if scene === "tab_foot_steps"}
      <g class="step step-a"><path d="M8.5 11c-1.6.2-2.8-1.5-2.5-3.8.3-2.1 1.6-3.8 3-3.5 1.4.3 1.8 2.3 1.4 4.3-.3 1.7-.8 2.8-1.9 3Z" /><circle cx="6" cy="13.2" r="1" /></g><g class="step step-b"><path d="M15.5 20c-1.6-.2-2.3-2.1-1.8-4.3.5-2 1.6-3.5 3-3.2 1.4.3 1.7 2.4 1.2 4.3-.5 1.8-1.3 3.3-2.4 3.2Z" /><circle cx="18.1" cy="10.5" r="1" /></g>
    {:else if scene === "tab_birds"}
      <path class="bird bird-a" d="M3 12c2.4-2.8 4.8-2.8 7 0 2.2-2.8 4.6-2.8 7 0" /><path class="bird bird-b" d="M12 7c1.6-1.9 3.2-1.9 4.7 0 1.5-1.9 3-1.9 4.3 0" />
    {:else if scene === "tab_onsen"}
      <path d="M4 13h16l-1.3 5.2A2.4 2.4 0 0 1 16.4 20H7.6a2.4 2.4 0 0 1-2.3-1.8L4 13Z" /><path d="M3 13h18M7 20l-1 1M17 20l1 1" />
      <path class="onsen-steam steam-a" d="M8.5 11c-1.4-1.2 1.2-2.4 0-4" /><path class="onsen-steam steam-b" d="M12 10c-1.4-1.2 1.2-2.4 0-5" /><path class="onsen-steam steam-c" d="M15.5 11c-1.4-1.2 1.2-2.4 0-4" />
    {:else if scene === "tab_cat_window"}
      <path d="M7 10 6 5l4 2h4l4-2-1 5a6 6 0 1 1-10 0Z" /><path d="M9 12h.1M15 12h.1M10.3 15c1.1.8 2.3.8 3.4 0" /><path class="cat-tail" d="M17 18c3.5 1.2 4.7-2.8 2.5-4" />
    {:else if scene === "tab_library"}
      <path d="M3.5 6.5c3.1-.8 5.9-.2 8.5 1.6v11c-2.6-1.8-5.4-2.4-8.5-1.6v-11ZM20.5 6.5c-3.1-.8-5.9-.2-8.5 1.6v11c2.6-1.8 5.4-2.4 8.5-1.6v-11Z" /><path class="book-page" d="M12 8.1c2.1-1.1 4.2-1.5 6.3-1.1v8.4c-2.2-.3-4.3.2-6.3 1.5" />
    {:else if scene === "tab_forest"}
      <g class="forest-sway"><path d="m8 3-4 7h2.3L3 15h4v6M8 3l4 7H9.7l3.3 5H9v6" /><path d="m16 6-3 6h2l-2.5 4H16v5M16 6l4 6h-2l2.5 4H17v5" /></g>
    {:else if scene === "tab_jungle"}
      <g class="jungle-sway"><path d="M12 21V9" /><path d="M12 13C6 13 4 9.2 4.5 5c4.7.2 7.4 2.8 7.5 8ZM12 16c5.6 0 8-3.2 7.6-7.1-4.4.1-7.5 2.5-7.6 7.1Z" /><path d="M7 10c1.5.2 3.1 1.2 5 3M17 12c-1.4.4-3 1.5-5 4" /></g>
    {:else if scene === "tab_beach_shore"}
      <circle class="shore-sun" cx="17" cy="7" r="2.4" /><path class="shore-wave wave-a" d="M3 14c2.3 0 2.3-1.8 4.6-1.8S10 14 12.3 14s2.3-1.8 4.6-1.8S19.2 14 21.5 14" /><path class="shore-wave wave-b" d="M4 18c2 0 2-1.4 4-1.4s2 1.4 4 1.4 2-1.4 4-1.4 2 1.4 4 1.4" /><path d="M3 21h18" />
    {:else if scene === "tab_traffic"}
      <g class="city-skyline"><path d="M4 21V10h5v11M9 21V5h7v16M16 21v-8h4v8M2.5 21h19" /><path class="city-window window-a" d="M6.5 13h.1M6.5 17h.1M12 8h.1M12 12h.1M12 16h.1M18 16h.1" /></g><path class="city-light" d="M3 7h3M18 9h3" />
    {:else if scene === "tab_elevator_music"}
      <rect x="5" y="3" width="14" height="18" rx="2" /><path d="M12 10v11M5 10h14" />
      <path class="elevator-arrow arrow-up" d="m9 8 3-3 3 3" /><path class="elevator-arrow arrow-down" d="m9 5 3 3 3-3" />
      <path class="elevator-door door-left" d="M8.5 12v7" /><path class="elevator-door door-right" d="M15.5 12v7" />
    {:else if scene === "tab_rainy_bedroom"}
      <path d="M4 13h16v7H4zM4 16h16M7 13V7h5a3 3 0 0 1 3 3v3" /><path class="bedroom-drop drop-a" d="m17 5-.7 2" /><path class="bedroom-drop drop-b" d="m20 7-.7 2" /><path class="bedroom-lamp" d="M7 9h3M8.5 9V6" />
    {:else if scene === "tab_brown_noise"}
      <path class="brown-wave wave-a" d="M3 8c2-2 4 2 6 0s4 2 6 0 4 2 6 0" /><path class="brown-wave wave-b" d="M3 12c2-2 4 2 6 0s4 2 6 0 4 2 6 0" /><path class="brown-wave wave-c" d="M3 16c2-2 4 2 6 0s4 2 6 0 4 2 6 0" />
    {:else if scene === "tab_space_observation"}
      <circle cx="12" cy="12" r="8.5" /><path class="space-orbit" d="M5 14c4.5 2.4 10.5 2.4 14 0" /><path class="space-planet" d="M7.2 15.3A6.3 6.3 0 0 1 17.8 10" /><path class="space-star star-a" d="m17 5 .4 1.1 1.1.4-1.1.4L17 8l-.4-1.1-1.1-.4 1.1-.4L17 5Z" /><path class="space-star star-b" d="m8 7 .3.8.8.3-.8.3-.3.8-.3-.8-.8-.3.8-.3L8 7Z" />
    {:else if scene === "tab_night_drive"}
      <path d="m8 21 2-15h4l2 15M5 21h14M11 16h2" /><path class="drive-line" d="M12 8v3" /><circle class="drive-light light-a" cx="6" cy="9" r="1" /><circle class="drive-light light-b" cx="18" cy="7" r="1" />
    {:else if scene === "tab_city_apartment"}
      <path d="M5 21V5h10v16M15 10h4v11M8 8h2M8 12h2M8 16h2M12 8h1M12 12h1M12 16h1M17 13h1M17 17h1" /><path class="apartment-moon" d="M18 3.5a2.7 2.7 0 0 0 2.8 3.2A3.1 3.1 0 1 1 18 3.5Z" />
    {:else if scene === "tab_farm"}
      <path d="M4 21V11l8-5 8 5v10M8 21v-6h8v6M5 11h14" /><path class="farm-blade blade-a" d="M12 10V5" /><path class="farm-blade blade-b" d="m12 10 4-2.5" /><path class="farm-blade blade-c" d="m12 10-4-2.5" /><circle class="farm-sun" cx="19" cy="5" r="1.5" />
    {:else}
      <path class="noise n1" d="M5 9v6" /><path class="noise n2" d="M8 6v12" /><path class="noise n3" d="M11 8v8" /><path class="noise n4" d="M14 4v16" /><path class="noise n5" d="M17 7v10" /><path class="noise n6" d="M20 10v4" />
    {/if}
  </svg>
</span>

<style>
  .scene-icon {
    width: 34px;
    height: 34px;
    display: grid;
    place-items: center;
    flex: 0 0 34px;
    border: 1px solid rgba(255, 255, 255, 0.11);
    border-radius: 12px;
    color: rgba(255, 255, 255, 0.58);
    background: rgba(255, 255, 255, 0.045);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
    transition: color 220ms ease, transform 300ms cubic-bezier(0.16, 1, 0.3, 1), background 220ms ease, border-color 220ms ease;
  }
  .scene-icon.active {
    color: #111315;
    border-color: rgba(17, 19, 21, 0.14);
    background: rgba(17, 19, 21, 0.075);
    transform: scale(1.05);
  }
  svg { width: 22px; height: 22px; overflow: visible; fill: none; stroke: currentColor; stroke-width: 1.55; stroke-linecap: round; stroke-linejoin: round; }
  .drop, .steam, .fall, .gust, .bolt, .flame, .snowflake, .lamp-glow, .leaf-sway, .wave, .rail, .key-tap, .step, .bird, .noise, .onsen-steam, .cat-tail, .book-page, .forest-sway, .jungle-sway, .shore-wave, .shore-sun, .city-skyline, .city-window, .city-light, .elevator-arrow, .elevator-door, .bedroom-drop, .bedroom-lamp, .brown-wave, .space-orbit, .space-planet, .space-star, .drive-line, .drive-light, .apartment-moon, .farm-blade, .farm-sun { transform-box: fill-box; transform-origin: center; }
  .active.rain .drop { animation: rain-fall 1s ease-in infinite; }
  .active.rain .drop-b { animation-delay: .22s; } .active.rain .drop-c { animation-delay: .44s; }
  .active.coffee .steam { animation: steam-rise 1.8s ease-in-out infinite; }
  .active.coffee .steam-b { animation-delay: .45s; }
  .active.waterfall .fall { animation: water-fall 1.1s linear infinite; }
  .active.waterfall .fall-b { animation-delay: .35s; }
  .active.lightning .bolt { animation: lightning-flash 2.2s ease-in-out infinite; }
  .active.wind .gust { animation: wind-drift 1.7s ease-in-out infinite; }
  .active.wind .gust-b { animation-delay: .22s; } .active.wind .gust-c { animation-delay: .44s; }
  .active.fire .flame-outer { animation: flame-flicker .9s ease-in-out infinite alternate; }
  .active.fire .flame-inner { animation: flame-flicker .7s .16s ease-in-out infinite alternate-reverse; }
  .active.snow .snowflake { animation: snow-turn 7s linear infinite; }
  .active.street .lamp-glow { fill: currentColor; animation: lamp-pulse 2s ease-in-out infinite; }
  .active.street .moon { animation: moon-drift 3s ease-in-out infinite; }
  .active.leaves .leaf-sway { animation: leaf-sway 2.2s ease-in-out infinite; transform-origin: 50% 100%; }
  .active.ocean .wave { animation: wave-shift 1.9s ease-in-out infinite; }
  .active.ocean .wave-b { animation-delay: -.55s; } .active.ocean .wave-c { animation-delay: -1.05s; }
  .active.train .rail { animation: rail-move .8s linear infinite; }
  .active.typing .key-tap { animation: key-press .8s steps(2, end) infinite; }
  .active.typing .key-b { animation-delay: .35s; }
  .active.footsteps .step-a { animation: step-walk 1.25s ease-in-out infinite; }
  .active.footsteps .step-b { animation: step-walk 1.25s .62s ease-in-out infinite; }
  .active.birds .bird-a { animation: bird-flap 1.1s ease-in-out infinite; }
  .active.birds .bird-b { animation: bird-flap 1.35s .2s ease-in-out infinite; }
  .active.static .noise { animation: noise-jump .8s steps(3, end) infinite; }
  .active.static .n2 { animation-delay: -.2s; } .active.static .n3 { animation-delay: -.4s; } .active.static .n4 { animation-delay: -.6s; } .active.static .n5 { animation-delay: -.3s; }
  .active.onsen .onsen-steam { animation: onsen-rise 2s ease-in-out infinite; }
  .active.onsen .steam-b { animation-delay: .42s; } .active.onsen .steam-c { animation-delay: .84s; }
  .active.cat .cat-tail { animation: cat-tail 1.8s ease-in-out infinite; transform-origin: 0 100%; }
  .active.library .book-page { animation: page-turn 2.6s ease-in-out infinite; transform-origin: 0 50%; }
  .active.forest .forest-sway { animation: forest-sway 2.8s ease-in-out infinite; transform-origin: 50% 100%; }
  .active.jungle .jungle-sway { animation: jungle-sway 2.3s ease-in-out infinite; transform-origin: 50% 100%; }
  .active.shore .shore-wave { animation: wave-shift 1.9s ease-in-out infinite; }
  .active.shore .wave-b { animation-delay: -.7s; }
  .active.shore .shore-sun { animation: lamp-pulse 2.8s ease-in-out infinite; }
  .active.city .city-skyline { animation: city-breathe 3.4s ease-in-out infinite; }
  .active.city .city-window { animation: city-window 2.8s steps(2, end) infinite; }
  .active.city .city-light { animation: city-light 1.9s ease-in-out infinite; }
  .active.elevator .arrow-up { animation: elevator-rise 2.4s ease-in-out infinite; }
  .active.elevator .arrow-down { animation: elevator-fall 2.4s 1.2s ease-in-out infinite; }
  .active.elevator .door-left { animation: elevator-left-door 3.2s ease-in-out infinite; }
  .active.elevator .door-right { animation: elevator-right-door 3.2s ease-in-out infinite; }
  .active.bedroom .bedroom-drop { animation: rain-fall 1.25s ease-in infinite; }
  .active.bedroom .drop-b { animation-delay: .5s; }
  .active.bedroom .bedroom-lamp { animation: lamp-pulse 2.6s ease-in-out infinite; }
  .active.brown .brown-wave { animation: brown-drift 2.3s ease-in-out infinite; }
  .active.brown .wave-b { animation-delay: -.7s; }
  .active.brown .wave-c { animation-delay: -1.4s; }
  .active.space .space-orbit { animation: space-orbit 4.8s linear infinite; }
  .active.space .space-planet { animation: space-breathe 3.2s ease-in-out infinite; }
  .active.space .space-star { animation: lamp-pulse 2.2s ease-in-out infinite; }
  .active.space .star-b { animation-delay: .8s; }
  .active.nightdrive .drive-line { animation: drive-road .85s linear infinite; }
  .active.nightdrive .drive-light { fill: currentColor; animation: drive-light 2s ease-in-out infinite; }
  .active.nightdrive .light-b { animation-delay: .6s; }
  .active.apartment .apartment-moon { animation: moon-drift 3s ease-in-out infinite; }
  .active.farm .farm-blade { animation: farm-turn 4.5s linear infinite; transform-origin: 50% 100%; }
  .active.farm .farm-sun { fill: currentColor; animation: lamp-pulse 3s ease-in-out infinite; }

  @keyframes rain-fall { 0% { opacity: 0; transform: translateY(-2px); } 35% { opacity: 1; } 100% { opacity: 0; transform: translateY(3px); } }
  @keyframes steam-rise { 0%, 100% { opacity: .35; transform: translateY(1px); } 50% { opacity: 1; transform: translateY(-2px); } }
  @keyframes water-fall { from { stroke-dasharray: 2 3; stroke-dashoffset: 5; } to { stroke-dasharray: 2 3; stroke-dashoffset: 0; } }
  @keyframes lightning-flash { 0%, 42%, 48%, 100% { opacity: .42; } 44%, 46% { opacity: 1; filter: drop-shadow(0 0 3px currentColor); } }
  @keyframes wind-drift { 0%, 100% { transform: translateX(-1px); opacity: .5; } 50% { transform: translateX(2px); opacity: 1; } }
  @keyframes flame-flicker { from { transform: scale(.96) skewX(-2deg); } to { transform: scale(1.04) skewX(2deg) translateY(-1px); } }
  @keyframes snow-turn { to { transform: rotate(360deg); } }
  @keyframes lamp-pulse { 0%, 100% { opacity: .45; filter: drop-shadow(0 0 0 currentColor); } 50% { opacity: 1; filter: drop-shadow(0 0 4px currentColor); } }
  @keyframes moon-drift { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-1.5px); } }
  @keyframes leaf-sway { 0%, 100% { transform: rotate(-3deg); } 50% { transform: rotate(4deg); } }
  @keyframes wave-shift { 0%, 100% { transform: translateX(-1px); } 50% { transform: translateX(1.5px); } }
  @keyframes rail-move { 0% { stroke-dasharray: 2 2; stroke-dashoffset: 4; } 100% { stroke-dasharray: 2 2; stroke-dashoffset: 0; } }
  @keyframes key-press { 0%, 65% { stroke-width: 1.6; transform: translateY(0); } 66%, 100% { stroke-width: 3; transform: translateY(1px); } }
  @keyframes step-walk { 0%, 100% { opacity: .35; transform: scale(.94); } 50% { opacity: 1; transform: scale(1.03); } }
  @keyframes bird-flap { 0%, 100% { transform: scaleY(.78); } 50% { transform: scaleY(1.18) translateY(-1px); } }
  @keyframes noise-jump { 0% { transform: scaleY(.65); } 50% { transform: scaleY(1.2); } 100% { transform: scaleY(.9); } }
  @keyframes onsen-rise { 0%, 100% { opacity: .28; transform: translateY(2px) scaleX(.92); } 50% { opacity: 1; transform: translateY(-2px) scaleX(1.08); } }
  @keyframes cat-tail { 0%, 100% { transform: rotate(-8deg); } 50% { transform: rotate(13deg) translateX(1px); } }
  @keyframes page-turn { 0%, 25%, 100% { opacity: .45; transform: scaleX(1); } 55% { opacity: 1; transform: scaleX(.68) skewY(-4deg); } }
  @keyframes forest-sway { 0%, 100% { transform: rotate(-1.5deg); } 50% { transform: rotate(2deg); } }
  @keyframes jungle-sway { 0%, 100% { transform: rotate(-2.5deg) scaleY(.98); } 50% { transform: rotate(3deg) scaleY(1.02); } }
  @keyframes city-breathe { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-.6px); } }
  @keyframes city-window { 0%, 45% { opacity: .38; } 46%, 100% { opacity: 1; filter: drop-shadow(0 0 2px currentColor); } }
  @keyframes city-light { 0%, 100% { opacity: .25; transform: translateX(-1px); } 50% { opacity: 1; transform: translateX(1px); } }
  @keyframes elevator-rise { 0%, 42%, 100% { opacity: .25; transform: translateY(1px); } 18% { opacity: 1; transform: translateY(-1px); } }
  @keyframes elevator-fall { 0%, 42%, 100% { opacity: .22; transform: translateY(-1px); } 18% { opacity: 1; transform: translateY(1px); } }
  @keyframes elevator-left-door { 0%, 30%, 76%, 100% { transform: translateX(0); } 45%, 62% { transform: translateX(-1.5px); } }
  @keyframes elevator-right-door { 0%, 30%, 76%, 100% { transform: translateX(0); } 45%, 62% { transform: translateX(1.5px); } }
  @keyframes brown-drift { 0%, 100% { transform: translateX(-1px); opacity: .48; } 50% { transform: translateX(1.4px); opacity: 1; } }
  @keyframes space-orbit { to { transform: rotate(360deg); } }
  @keyframes space-breathe { 0%, 100% { opacity: .55; transform: scale(.97); } 50% { opacity: 1; transform: scale(1.03); } }
  @keyframes drive-road { from { stroke-dasharray: 2 3; stroke-dashoffset: 5; } to { stroke-dasharray: 2 3; stroke-dashoffset: 0; } }
  @keyframes drive-light { 0%, 100% { opacity: .25; transform: translateY(-1px); } 50% { opacity: 1; transform: translateY(1px); } }
  @keyframes farm-turn { to { transform: rotate(360deg); } }

  @media (prefers-reduced-motion: reduce) {
    .scene-icon *, .scene-icon { animation: none !important; transition-duration: .01ms !important; }
  }
</style>
