// SPDX-License-Identifier: GPL-3.0-only
// Original perspective study of a broad industrial sword. No FF7 images/models.
export const titleScene=`<svg viewBox="0 0 1000 900" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
 <defs>
  <linearGradient id="vii-steel" x1="415" y1="430" x2="582" y2="447" gradientUnits="userSpaceOnUse"><stop stop-color="#142538"/><stop offset=".13" stop-color="#4e6c80"/><stop offset=".3" stop-color="#c0d0d8"/><stop offset=".36" stop-color="#829baa"/><stop offset=".4" stop-color="#314b60"/><stop offset=".83" stop-color="#203447"/><stop offset="1" stop-color="#07131f"/></linearGradient>
  <linearGradient id="vii-bevel" x1="420" y1="320" x2="480" y2="760" gradientUnits="userSpaceOnUse"><stop stop-color="#f0f5f4"/><stop offset=".32" stop-color="#a0bdcd"/><stop offset=".58" stop-color="#3c617c"/><stop offset="1" stop-color="#162e40"/></linearGradient>
  <linearGradient id="vii-side" x1="570" x2="585" gradientUnits="userSpaceOnUse"><stop stop-color="#56778b"/><stop offset="1" stop-color="#06101a"/></linearGradient>
  <linearGradient id="vii-guard" x1="398" y1="300" x2="598" y2="319" gradientUnits="userSpaceOnUse"><stop stop-color="#223b4f"/><stop offset=".35" stop-color="#afc5cf"/><stop offset=".5" stop-color="#456274"/><stop offset="1" stop-color="#0b1c2b"/></linearGradient>
  <linearGradient id="vii-leather"><stop stop-color="#0b1117"/><stop offset=".45" stop-color="#5e5d57"/><stop offset=".6" stop-color="#303835"/><stop offset="1" stop-color="#111b20"/></linearGradient>
  <linearGradient id="vii-light" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#b6d8ec" stop-opacity="0"/><stop offset=".55" stop-color="#b6d8ec" stop-opacity=".07"/><stop offset="1" stop-color="#b6d8ec" stop-opacity=".02"/></linearGradient>
  <radialGradient id="vii-ground"><stop stop-color="#7b96a6" stop-opacity=".18"/><stop offset=".5" stop-color="#3a5265" stop-opacity=".07"/><stop offset="1" stop-color="#030712" stop-opacity="0"/></radialGradient>
  <radialGradient id="vii-contact"><stop stop-color="#000" stop-opacity="1"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
 </defs>
 <!-- A narrow local light, ample unlit space, and a contact point fixed at (510,766). -->
 <path d="M797 -40L852 -40L612 792L438 790Z" fill="url(#vii-light)"/>
 <ellipse cx="535" cy="776" rx="253" ry="60" fill="url(#vii-ground)"/>
 <path d="M510 766L272 839L238 839L482 767Z" fill="#000" opacity=".8"/>
 <ellipse cx="510" cy="770" rx="49" ry="10" fill="url(#vii-contact)"/>
 <g transform="rotate(28 510 766)">
  <!-- Side plane and bevel remain distinct from the reflected front face. -->
  <path d="M574 320L583 326L583 679L519 766L510 766L574 674Z" fill="url(#vii-side)" stroke="#132637"/>
  <path d="M422 320L574 320L574 674L510 766L422 694Z" fill="url(#vii-steel)" stroke="#668294" stroke-width="1"/>
  <path d="M422 320L437 330L437 688L510 766L422 694Z" fill="url(#vii-bevel)"/>
  <path d="M437 330L558 330L558 667L510 737L521 689L541 659L541 345L437 345Z" fill="#091625" opacity=".42"/>
  <path d="M447 355V658L489 714" fill="none" stroke="#d6e5eb" stroke-opacity=".24" stroke-width="2"/>
  <path d="M437 425L550 456L550 475L437 444Z" fill="#e0f0f5" opacity=".07"/>
  <circle cx="477" cy="358" r="9" fill="#030a10" stroke="#829dad" stroke-width="2"/><circle cx="515" cy="358" r="9" fill="#030a10" stroke="#829dad" stroke-width="2"/>
  <path d="M397 299L591 299L603 315L584 328L410 328L393 315Z" fill="url(#vii-guard)" stroke="#7994a4"/>
  <path d="M410 328L584 328L592 335L414 335Z" fill="#091522"/>
  <path d="M476 162L517 162L518 298L474 298Z" fill="url(#vii-leather)" stroke="#4c6575"/>
  <path d="M476 177L516 190M475 199L517 212M475 222L517 235M475 245L518 258M475 268L518 281" stroke="#9d9d89" stroke-opacity=".38" stroke-width="5"/>
  <path d="M469 148L524 148L529 163L520 171L472 169L465 158Z" fill="url(#vii-guard)" stroke="#869caa"/>
  <path d="M484 140L512 140L524 148L469 148Z" fill="#bac8cd"/>
 </g>
 <!-- Small broken ground planes meet the blade rather than a floating icon shadow. -->
 <path d="M495 762L475 770L501 773L514 767L535 777L551 774M512 776L493 790L477 793M538 784L557 791" stroke="#697b85" stroke-opacity=".3" fill="none"/>
 <path d="M468 775L483 769L487 774Z M522 775L533 769L540 777Z" fill="#172632"/>
</svg>`;
