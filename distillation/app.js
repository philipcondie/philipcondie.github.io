// element variables (browser only)
let form, totalTraysInput, feedTrayInput, columnPressureInput, feedRateInput, feedCompositionInput, distCompositionInput, btmsCompositionInput;
let ids, els, msgs;

let previousTrayCount;
let previousFeedTray;
let lastSimulationFailed = false;

if (typeof document !== 'undefined') {
    ids = ['totalTrays', 'feedTray', 'feedComposition', 'distillateComposition', 'bottomsComposition'];
    els = Object.fromEntries(ids.map(id => [id,document.getElementById(id)]));
    msgs = Object.fromEntries(ids.map(id => [id, document.getElementById(id + '-msg')]));
    form = document.getElementById('input-form');
    totalTraysInput = document.getElementById('totalTrays');
    feedTrayInput = document.getElementById('feedTray');
    columnPressureInput = document.getElementById('columnPressure');
    feedRateInput = document.getElementById('feedRate');
    feedCompositionInput = document.getElementById('feedComposition');
    distCompositionInput = document.getElementById('distillateComposition');
    btmsCompositionInput = document.getElementById('bottomsComposition');
}

function updateFeedInfo() {
    const feedRate = feedRateInput?.valueAsNumber || 0;
    const feedComp = feedCompositionInput?.valueAsNumber || 0;

    // Calculate approximate feed temperature (saturated liquid assumption)
    const feedTemp = feedComp > 0 ? 
        equilibriumTemperatureFromX(
            (columnPressureInput?.valueAsNumber || 100) + 14.7,
            feedComp / 100,
            propaneConstants,
            butaneConstants
        ) : 0;
    
    const feedInfoBox = document.querySelector('.feed-info-box');
    if (feedInfoBox) {
        feedInfoBox.querySelector('#feed-rate').textContent = `${fmt(feedRate, 0)}`;
        feedInfoBox.querySelector('#feed-composition').textContent = `${fmt(feedComp, 1)}`;
        feedInfoBox.querySelector('#feed-temp').textContent = `${fmt(feedTemp, 0)}`;
    }
}

function updateProductRates(products, lightAntConsts, heavyAntConsts) {
    if (!Number.isFinite(products.distRate) || !Number.isFinite(products.btmsRate) || 
        !Number.isFinite(products.distComp) || !Number.isFinite(products.btmsComp) ||
        !Number.isFinite(products.refluxRate)){

        document.querySelector('#dist-rate').textContent = ``;
        document.querySelector('#btms-rate').textContent = ``;
        document.querySelector('#reflux-rate').textContent = ``; 
        return;
    }
    document.querySelector('#dist-rate').textContent = `${fmt(molarToMass(products.distRate,products.distComp,lightAntConsts, heavyAntConsts),0)}`;
    document.querySelector('#btms-rate').textContent = `${fmt(molarToMass(products.btmsRate,products.btmsComp,lightAntConsts, heavyAntConsts),0)}`;
    document.querySelector('#reflux-rate').textContent = `${fmt(molarToMass(products.refluxRate,products.distComp,lightAntConsts, heavyAntConsts),0)}`;
}

function updateTrayData(trays, pressure, rateData, lightAntConsts, heavyAntConsts) {
    // do condenser data
    updateCondenserData(trays[0],pressure,rateData,lightAntConsts,heavyAntConsts);
    for (const t of trays) {
        if (t.trayNumber > totalTraysInput.valueAsNumber) {
            updateReboilerData(t, rateData, lightAntConsts, heavyAntConsts);
            continue;
        }
        
        const trayNode = document.querySelector(`[data-stage="${t.trayNumber}"]`);
        if (!trayNode) continue;
        trayNode.querySelector('.x').textContent = fmt(t.liqComp*100, 1) + '%';
        trayNode.querySelector('.y').textContent = fmt(t.vapComp*100, 1) + '%';
        trayNode.querySelector('.T').textContent = fmt(t.temperature, 0);
        
        // Update composition bars (height based on composition, 0-1 scale to 0-100%)
        const xBar = trayNode.querySelector('.x-bar');
        const yBar = trayNode.querySelector('.y-bar');
        if (xBar && Number.isFinite(t.liqComp)) {
            xBar.style.height = `${Math.max(0, Math.min(100, t.liqComp * 100))}%`;
        }
        if (yBar && Number.isFinite(t.vapComp)) {
            yBar.style.height = `${Math.max(0, Math.min(100, t.vapComp * 100))}%`;
        }
    }
}

function updateReboilerData(reboilerData,rateData,lightAntConsts,heavyAntConsts) {
    const reboilerNode = document.querySelector('[data-stage="reboiler"]');
    if (!reboilerNode) return;
    
    reboilerNode.querySelector('.x').textContent = fmt(reboilerData.liqComp*100, 1) + '%';
    reboilerNode.querySelector('.y').textContent = fmt(reboilerData.vapComp*100, 1) + '%';
    reboilerNode.querySelector('.T').textContent = fmt(reboilerData.temperature, 0);
    
    // Update composition bars
    const xBar = reboilerNode.querySelector('.x-bar');
    const yBar = reboilerNode.querySelector('.y-bar');
    if (xBar && Number.isFinite(reboilerData.liqComp)) {
        xBar.style.height = `${Math.max(0, Math.min(100, reboilerData.liqComp * 100))}%`;
    }
    if (yBar && Number.isFinite(reboilerData.vapComp)) {
        yBar.style.height = `${Math.max(0, Math.min(100, reboilerData.vapComp * 100))}%`;
    }
    
    // Calculate and display heat duty (simplified)
    const reboilerFeedRate = rateData.btmsRate * reboilerData.boilUp;
    const heatDuty = calculateDuty(reboilerFeedRate, reboilerData.liqComp, lightAntConsts, heavyAntConsts);
    const dutyValueEl = reboilerNode.querySelector('.duty-value');
    if (dutyValueEl) {
        dutyValueEl.textContent = fmt(heatDuty, 0);
    }
}

function updateCondenserData(condenserData, pressure, rateData,lightAntConsts,heavyAntConsts) {
    // condenser has same inlet vap and outlet liq composition
    // temperature is based on bubble point of liquid
    const temperature = equilibriumTemperatureFromX(pressure,condenserData.vapComp,lightAntConsts,heavyAntConsts)
    const condenserNode = document.querySelector('[data-stage="condenser"]');
    if (!condenserNode) return;

    condenserNode.querySelector('.x').textContent = fmt(condenserData.vapComp*100, 1) + '%';
    condenserNode.querySelector('.y').textContent = fmt(condenserData.vapComp*100, 1) + '%';
    condenserNode.querySelector('.T').textContent = fmt(temperature, 0);

    // Update composition bars
    const xBar = condenserNode.querySelector('.x-bar');
    const yBar = condenserNode.querySelector('.y-bar');
    if (xBar && Number.isFinite(condenserData.liqComp)) {
        xBar.style.height = `${Math.max(0, Math.min(100, condenserData.liqComp * 100))}%`;
    }
    if (yBar && Number.isFinite(condenserData.vapComp)) {
        yBar.style.height = `${Math.max(0, Math.min(100, condenserData.vapComp * 100))}%`;
    }

    const condenserFeedRate = rateData.distRate * condenserData.refluxRatio;
    const duty = calculateDuty(condenserFeedRate,condenserData.vapComp,lightAntConsts,heavyAntConsts);
    // Calculate and display heat duty (simplified)
    const dutyValueEl = condenserNode.querySelector('.duty-value');
    if (dutyValueEl) {
        dutyValueEl.textContent = fmt(duty, 0);
    }
}

function populateColumnElement(numTrays) {
    const columnEl = document.getElementById('column');
    columnEl.replaceChildren();

    const frag = document.createDocumentFragment();
    
    for (let i = 1; i <= numTrays; i++) {
        const template = document.getElementById('tray-template');
        const node = template.content.firstElementChild.cloneNode(true);
        node.dataset.stage = i;

        const feedTrayNum = feedTrayInput?.valueAsNumber || 5;
        const title = i === feedTrayNum ? `Tray ${i} (FEED)` : `Tray ${i}`;
        node.querySelector('.title').textContent = title;

        frag.appendChild(node);
    }
    columnEl.appendChild(frag);
}

function setMsgById(id, text) {
    msgs[id].textContent = text || '';
}

function setMsgByObject(element, text) {
    msgs[element.id].textContent = text || '';
}

function fmt(num, decimalPlaces) {
    return (Number.isFinite(num) ? num.toFixed(decimalPlaces) : '-');
}

// function for validating inputs
function validateRawInputs() {
    ids.forEach(id => {els[id].setCustomValidity(''); setMsgById(id,'');});
    // check compositions
    if (Number.isFinite(distCompositionInput.valueAsNumber) && Number.isFinite(btmsCompositionInput.valueAsNumber)) {
        if (distCompositionInput.valueAsNumber <= btmsCompositionInput.valueAsNumber){
            const msg = 'Distillate Composition must be greater than the bottoms composition.';
            distCompositionInput.setCustomValidity(msg);
            setMsgByObject(distCompositionInput,msg);
        }
    }

    if (Number.isFinite(distCompositionInput.valueAsNumber) && Number.isFinite(feedCompositionInput.valueAsNumber)){
        if (distCompositionInput.valueAsNumber <= feedCompositionInput.valueAsNumber){
            const msg = 'Distillate Composition must be greater than the feed composition.';
            distCompositionInput.setCustomValidity(msg);
            setMsgByObject(distCompositionInput,msg);
        }
    }

    if (Number.isFinite(btmsCompositionInput.valueAsNumber) && Number.isFinite(feedCompositionInput.valueAsNumber)){
        if (btmsCompositionInput.valueAsNumber >= feedCompositionInput.valueAsNumber){
            const msg = 'Bottoms Composition must be less than the feed composition.';
            btmsCompositionInput.setCustomValidity(msg);
            setMsgByObject(btmsCompositionInput,msg);
        }
    }

    // check trays
    if (Number.isFinite(feedTrayInput.valueAsNumber) && Number.isFinite(totalTraysInput.valueAsNumber)) {
        if (feedTrayInput.valueAsNumber > totalTraysInput.valueAsNumber || feedTrayInput.valueAsNumber < 1) {
            const msg = `The feed tray must be between 1 and ${totalTraysInput.valueAsNumber}.`;
            feedTrayInput.setCustomValidity(msg);
            setMsgByObject(feedTrayInput,msg);
        }
    }

    const minTrays = minimumTrays(distCompositionInput.valueAsNumber/100,btmsCompositionInput.valueAsNumber/100,columnPressureInput.valueAsNumber+ 14.7, propaneConstants,butaneConstants) -1;
    if (Number.isFinite(totalTraysInput.valueAsNumber) && totalTraysInput.valueAsNumber < Math.round(minTrays)){
        const msg = `The total trays must be greater than the minimum required number of trays: ${Math.round(minTrays)}.`
        totalTraysInput.setCustomValidity(msg);
        setMsgByObject(totalTraysInput,msg);
    }
    // check built in handling
    ids.forEach(id => {
        if (!els[id].validity.valid && !msgs[id].textContent) {
            setMsgById(id, els[id].validationMessage);
        }
    });
    
    return form.checkValidity()
}

function runSimulation() {
    lastSimulationFailed = false;
    const molarFeedRate = massToMolar(feedRateInput.valueAsNumber,feedCompositionInput.valueAsNumber/100,propaneConstants,butaneConstants);
    
    const refluxRatio = columnSolver(
        molarFeedRate,
        feedCompositionInput.valueAsNumber/100,
        distCompositionInput.valueAsNumber/100,
        btmsCompositionInput.valueAsNumber/100,
        columnPressureInput.valueAsNumber + 14.7,
        feedTrayInput.valueAsNumber,
        totalTraysInput.valueAsNumber + 1,
        propaneConstants,
        butaneConstants
    );

    if (refluxRatio <= 0) {
        const columnEl = document.getElementById('column');
        columnEl.innerHTML = '<h2>WARNING!</h2><p class="error">The specified conditions are not feasible. Please adjust your inputs.</p>';
        lastSimulationFailed = true;
        return;
    }

    const trays = generateColumnData(
        molarFeedRate,
        feedCompositionInput.valueAsNumber/100,
        distCompositionInput.valueAsNumber/100,
        btmsCompositionInput.valueAsNumber/100,
        columnPressureInput.valueAsNumber+14.7,
        feedTrayInput.valueAsNumber,
        totalTraysInput.valueAsNumber,
        refluxRatio,
        propaneConstants,
        butaneConstants
    );
    const rates = productRates(molarFeedRate,feedCompositionInput.valueAsNumber/100,distCompositionInput.valueAsNumber/100,btmsCompositionInput.valueAsNumber/100);
    const refluxRate = rates[0]*refluxRatio;
    const rateData = {
        "feedRate" : molarFeedRate,
        "distRate" : rates[0],
        "btmsRate" : rates[1],
        "distComp": distCompositionInput.valueAsNumber/100,
        "btmsComp":  btmsCompositionInput.valueAsNumber/100,
        "refluxRate": refluxRate
    }
    updateProductRates(rateData,propaneConstants,butaneConstants);
    updateTrayData(trays, columnPressureInput.valueAsNumber+14.7, rateData, propaneConstants, butaneConstants);
}

function renderPage() {
    const valid = validateRawInputs();
    const currentTrayCount = totalTraysInput.valueAsNumber || 8;
    const currentFeedTray = feedTrayInput.valueAsNumber || 5;
    if ((currentTrayCount !== previousTrayCount) || (currentFeedTray !== previousFeedTray)) {
        populateColumnElement(currentTrayCount);
        previousTrayCount = currentTrayCount;
        previousFeedTray = currentFeedTray;
    }
    if (lastSimulationFailed) {
        populateColumnElement(currentTrayCount);
    }
    updateFeedInfo();
    if(valid) {
        runSimulation();
    }
}

// Only add event listener in browser environment
if (typeof document !== 'undefined' && form) {
    form.addEventListener('change', renderPage);
    populateColumnElement(totalTraysInput.valueAsNumber || 8)
    previousTrayCount = totalTraysInput.valueAsNumber || 8;
    previousFeedTray = feedTrayInput.valueAsNumber || 5;
    renderPage();
}

