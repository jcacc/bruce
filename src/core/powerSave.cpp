#include "powerSave.h"
#include "display.h"
#include "settings.h"

/* Check if it's time to put the device to sleep */
#define SCREEN_OFF_DELAY 5000

void fadeOutScreen(int startValue) {
    for (int brightValue = startValue; brightValue >= 0; brightValue -= 1) {
        setBrightness(max(brightValue, 0), false);
        delay(5);
    }
    turnOffDisplay();
}

void checkPowerSaveTime() {
    if (bruceConfig.dimmerSet == 0) return;

    unsigned long elapsed = millis() - previousMillis;
    int startDimmerBright = bruceConfig.bright / 3;
    int dimmerSetMs = bruceConfig.dimmerSet * 1000;

    if (elapsed >= dimmerSetMs && !dimmer && !isSleeping) {
        dimmer = true;
        setBrightness(startDimmerBright, false);
    } else if (elapsed >= (dimmerSetMs + SCREEN_OFF_DELAY) && !isScreenOff && !isSleeping) {
        isScreenOff = true;
        fadeOutScreen(startDimmerBright);
    }
}

// Sleep Mode only blanks the panel and waits for a key (see setSleepMode()).
// It used to also drop the CPU to 80 MHz and disable the core/loop watchdogs;
// with those in place the T-Embed CC1101 could not be woken by its buttons and
// flooded "task_wdt: task not found" until a hard reset. The wait loop yields,
// so the watchdogs can stay as they are.
void sleepModeOn() {
    isSleeping = true;

    int startDimmerBright = bruceConfig.bright / 3;

    fadeOutScreen(startDimmerBright);

    panelSleep(true); //  power down screen
    delay(200);
}

void sleepModeOff() {
    isSleeping = false;

    panelSleep(false); // wake the screen back up

    getBrightness();
    delay(200);
}
