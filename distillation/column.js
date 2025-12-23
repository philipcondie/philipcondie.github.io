/**
 * Global constants used in the calculations
 */
const MAXITERATIONS = 100;
const TOL = 0.001;

/**
 * Antoine Equation Constants
 */
const propaneConstants = {
    A: 4.53678,
    B: 1149.36,
    C: 24.906,
    mol_wt: 44.097,
    hVap: 6986.24159
}
const butaneConstants = {
    A: 4.35576,
    B: 1175.581,
    C: -2.071,
    mol_wt: 58.12,
    hVap: 9630.26533
}

/**
 * Utility functions 
 */

function molarToMass(molarRate, composition, lightConsts, heavyConsts) {
    const combinedMolWt = composition * lightConsts.mol_wt + (1-composition) * heavyConsts.mol_wt;
    return combinedMolWt * molarRate;
}

function massToMolar(massRate, composition, lightConsts,heavyConsts) {
    const combinedMolWt = composition * lightConsts.mol_wt + (1-composition) * heavyConsts.mol_wt;
    return massRate / combinedMolWt;
}

/**
 * calculates an approximate heat duty based on the boil-up ratio and the latent heat
 * @param {number} vaporizationRate
 * @param {number} liqComp 
 * @param {object} lightAntConsts 
 * @param {object} heavyAntConsts 
 * @returns {number}
 */
function calculateDuty(vaporizationRate, liqComp, lightAntConsts, heavyAntConsts) {   
    const approxLatentHeat = liqComp * (lightAntConsts.hVap) + (1-liqComp) * (heavyAntConsts.hVap);
    return vaporizationRate * approxLatentHeat / 1000;
}

/**
 * Vapor-Liquid Equilibrium Functions
 */

/**
 * calculates the equlibrium temperature for a compound given a pressure
 * 
 * pressure input assumes psia. 
 * temperature output assumes F
 * 
 * antoine constnats use K and bar
 * @param {number} pressure 
 * @param {object} antConsts 
 * @returns {number}
 */
function boilingPointTemperature(pressure, antConsts) {
    const pbar = (pressure) / 14.503773773;
    const logP = Math.log10(pbar);
    const tempK = antConsts.B / (antConsts.A - logP)  - antConsts.C;
    return (tempK - 273.15 ) * 9/5 + 32;
}

/**
 * calculates the vapor pressure for a compound
 * 
 * temperature is F
 * pressure is psia
 * antoine eqn constants use K and bar
 * @param {number} temperature 
 * @param {object} antConsts 
 * @returns {number}
 */
function vaporPressure(temperature, antConsts) {
    const tempK = (temperature - 32) * 5 / 9 + 273.15;
    const logP = antConsts.A - (antConsts.B / (tempK + antConsts.C));
    const Pbar = 10 ** logP;
    return Pbar * 14.503773773;
}

/**
 * helper equation for solving for equilibrium mixture conditions
 * Raoult's law for binary mixture
 * @param {number} temperature 
 * @param {number} pressure 
 * @param {number} liqMolFrac 
 * @param {object} lightAntConsts 
 * @param {object} heavyAntConsts 
 * @returns {number}
 */
function binaryequilibriumEquationFromX(temperature, pressure, liqMolFrac, lightAntConsts, heavyAntConsts) {
    const param1 = liqMolFrac * vaporPressure(temperature,lightAntConsts);
    const param2 = (1 - liqMolFrac) * vaporPressure(temperature, heavyAntConsts);
    return pressure - (param1 + param2);
}

/**
 * helper equation for solving for equilibrium mixture conditions
 * Raoult's law for binary mixture
 * @param {number} temperature 
 * @param {number} pressure 
 * @param {number} vapMolFrac 
 * @param {object} lightAntConsts 
 * @param {object} heavyAntConsts 
 * @returns {number}
 */
function binaryequilibriumEquationFromY(temperature, pressure, vaporMolFrac, lightAntConsts, heavyAntConsts) {
    const param1 = vaporMolFrac * pressure / vaporPressure(temperature,lightAntConsts);
    const param2 = (1 - vaporMolFrac) * pressure / vaporPressure(temperature, heavyAntConsts);
    return param1 + param2 - 1;
}

/**
 * calculates the equilibrium temperature for a binary mixture at a given pressure and liquid composition
 * 
 * @param {number} pressure 
 * @param {number} liquidMolFrac 
 * @param {object} lightAntConsts 
 * @param {object} heavyAntConsts 
 * @returns {number}
 */
function equilibriumTemperatureFromX(pressure, liquidMolFrac, lightAntConsts, heavyAntConsts) {
    // solve using bisection
    // need to get bracketing temperatures for this pressure
    let maxT = boilingPointTemperature(pressure, lightAntConsts);
    let minT = boilingPointTemperature(pressure, heavyAntConsts);
    let tempGuess= (maxT + minT) / 2;
    let result = 0;
    while (Math.abs(result = binaryequilibriumEquationFromX(tempGuess,pressure,liquidMolFrac,lightAntConsts,heavyAntConsts)) > TOL) {
        // if negative then need to reduce T. if positive need to increase T
        if (result > 0) {
            maxT = tempGuess;
            tempGuess = (minT + tempGuess) / 2;
        } else {
            minT = tempGuess;
            tempGuess = (maxT + tempGuess) / 2;
        }
    }
    return tempGuess;
}

/**
 * calculates the equilibrium temperature for a binary mixture at a given pressure and vapor composition
 * 
 * @param {number} pressure 
 * @param {number} vaporMolFrac 
 * @param {object} lightAntConsts 
 * @param {object} heavyAntConsts 
 * @returns {number}
 */
function equilibriumTemperatureFromY(pressure, vaporMolFrac, lightAntConsts, heavyAntConsts) {
    // solve using bisection
    // need to get bracketing temperatures for this pressure
    let maxT = boilingPointTemperature(pressure, lightAntConsts);
    let minT = boilingPointTemperature(pressure, heavyAntConsts);
    let tempGuess= (maxT + minT) / 2;
    let result = 0;
    while (Math.abs(result = binaryequilibriumEquationFromY(tempGuess,pressure,vaporMolFrac,lightAntConsts,heavyAntConsts)) > TOL) {
        // if negative then need to reduce T. if positive need to increase T
        if (result > 0) {
            maxT = tempGuess;
            tempGuess = (minT + tempGuess) / 2;
        } else {
            minT = tempGuess;
            tempGuess = (maxT + tempGuess) / 2;
        }
    }
    return tempGuess;
}

/**
 * calculates the equilibrium liquid composition given a pressure and vapor mole fraction
 * @param {number} pressure 
 * @param {number} vaporMolFrac 
 * @param {object} lightAntConsts 
 * @param {object} heavyAntConsts 
 * @returns {number}
 */
function liqMolFraction(pressure, vaporMolFrac, lightAntConsts, heavyAntConsts) {
    const temperature = equilibriumTemperatureFromY(pressure,vaporMolFrac,lightAntConsts,heavyAntConsts);
    return vaporMolFrac * pressure / vaporPressure(temperature,lightAntConsts);
}

/**
 * calculates the equilibrium vapor composition given a pressure and liquid mole fraction
 * @param {number} pressure 
 * @param {number} liquidMolFrac 
 * @param {object} lightAntConsts 
 * @param {object} heavyAntConsts 
 * @returns {number}
 */
function vapMolFraction(pressure,liquidMolFrac, lightAntConsts, heavyAntConsts) {
    const temperature = equilibriumTemperatureFromX(pressure,liquidMolFrac,lightAntConsts,heavyAntConsts);
    return liquidMolFrac * vaporPressure(temperature, lightAntConsts) / pressure;
}


/**
 * Distillation Material Balance Equations
 */


/**
 * calculates distillate and bottoms product rates given feed rate/composition and product specs
 * @param {number} feedRate 
 * @param {number} feedXp 
 * @param {number} distillateXp 
 * @param {number} bottomsXp 
 * @returns {number}
 */
function productRates(feedRate, feedXp, distillateXp, bottomsXp) {
    const distillateRate = feedRate * (feedXp - bottomsXp) / (distillateXp - bottomsXp);
    const bottomsRate = feedRate - distillateRate;
    return [distillateRate, bottomsRate];
}

/**
 * calculates the boil up ratio 
 * @param {number} refluxRatio 
 * @param {number} distillateRate 
 * @param {number} bottomsRate 
 * @returns {number}
 */
function boilUpRatio(refluxRatio, distillateRate, bottomsRate) {
    return (refluxRatio + 1) * distillateRate / bottomsRate;
}

/**
 * calculates the McCabe-Thiele operating line for the recetifying section
 * @param {*} refluxRatio 
 * @param {*} distillateMolFrac 
 * @param {*} liquidMolFrac 
 * @returns {number}
 */
function rectifyingOperatingLine(refluxRatio, distillateMolFrac, liquidMolFrac) {
    return refluxRatio / (refluxRatio + 1) * liquidMolFrac + distillateMolFrac / (refluxRatio + 1);
}

/**
 * calculates the McCabe-Thiele operating line for the stripping section
 * @param {number} boilUpRatio 
 * @param {number} bottomsMolFrac 
 * @param {number} vaporMolFraction
 * @returns {number}
 */
function strippingOperatingLine(boilUpRatio, bottomsMolFrac, vaporMolFraction) {
    return (vaporMolFraction + bottomsMolFrac / boilUpRatio) * boilUpRatio / (boilUpRatio + 1);
}

// use operating line to get y. use equilibrium to x
// operating line y_(i+1) = R / (R + 1) * x_i + x_D/(R+1)
// operating line y_(i) = (S + 1) / S * x_(i+1) - x_B/S 

/**
 * solves the material balance and VLE equations for the rectifying section and returns the liquid molar composition for the feed tray
 * starts at the top tray and alternatively uses the VLE equation and material balance to find the conditions for the next tray
 * @param {number} refluxRatio 
 * @param {number} pressure 
 * @param {number} distillateMolFrac 
 * @param {number} feedTray 
 * @param {object} lightAntConsts 
 * @param {object} heavyAntConsts 
 * @returns {number}
 */
function rectifyingSection(refluxRatio, pressure, distillateMolFrac, feedTray, lightAntConsts, heavyAntConsts) {
    let vapMolFrac = distillateMolFrac;
    // first tray do not need to do mass balance
    let liqMolFrac = liqMolFraction(pressure,distillateMolFrac,lightAntConsts,heavyAntConsts);
    for (let i = 2; i <= feedTray; i++) {
        vapMolFrac = rectifyingOperatingLine(refluxRatio,distillateMolFrac,liqMolFrac);
        liqMolFrac = liqMolFraction(pressure,vapMolFrac,lightAntConsts,heavyAntConsts);
    }
    return liqMolFrac;
}

/**
 * solves the material balance and VLE equations for the stripping section and returns the liquid molar composition for the feed tray
 * starts at the reboiler and alternatively uses the VLE equation and material balance to find the conditions for the next tray
 * @param {number} boilUpRatio 
 * @param {number} pressure 
 * @param {number} bottomsMolFrac 
 * @param {number} feedTray 
 * @param {number} totalTrays 
 * @param {object} lightAntConsts 
 * @param {object} heavyAntConsts 
 * @returns {number}
 */
function strippingSection(boilUpRatio, pressure, bottomsMolFrac, feedTray, totalTrays, lightAntConsts, heavyAntConsts) {
    let liqMolFrac = bottomsMolFrac;
    let vapMolFrac = vapMolFraction(pressure,liqMolFrac,lightAntConsts,heavyAntConsts);
    for(let i = totalTrays; i >= feedTray; i--) {
        liqMolFrac = strippingOperatingLine(boilUpRatio,bottomsMolFrac,vapMolFrac);
        vapMolFrac = vapMolFraction(pressure,liqMolFrac,lightAntConsts,heavyAntConsts);
    }
    return liqMolFrac;
}

/**
 * determines the reflux ratio required to achieve the specified product outputs given the feed conditions and column set up
 * with the McCabe-Thiele assumptions, the column is fully determined with these givens and the reflux ratio
 * 
 * A guess for the reflux ratio is used to find the feed tray liquid composition based on the stripping section and the rectifying section.
 * The reflux ratio is adjusted until the feed tray composition converges.
 * 
 * The solving approach is to use the bisection method bracketed by the minimum reflux ratio and 5 times the min. reflux ratio. This covers
 * most cases.
 * 
 * @param {number} feedRate 
 * @param {number} xFeed 
 * @param {number} xDistillate 
 * @param {number} xBottoms 
 * @param {number} pressure 
 * @param {number} feedTray 
 * @param {number} totalTrays 
 * @param {object} lightAntConsts 
 * @param {object} heavyAntConsts 
 * @returns {number}
 */
function columnSolver(feedRate,xFeed,xDistillate,xBottoms,pressure,feedTray,totalTrays,lightAntConsts,heavyAntConsts) {
    /*
        Column is fully determined if the reflux rate is found
        Bracket the operating conditions with the minimum reflux ratio and a reasonable max R.
        Max R is found by progressively increasing it until the residual error changes sign.
        Use bisection method to iterate and find the actual reflux ratio
    */
    let minR = minimumRefluxRatio(xFeed,xDistillate,pressure,lightAntConsts,heavyAntConsts);
    minR = Math.max(1e-8, minR);
    let residualLo = feedTrayDelta(minR,feedRate,xFeed,xDistillate,xBottoms,pressure,feedTray,totalTrays,lightAntConsts,heavyAntConsts);
    if (Math.abs(residualLo) < TOL) return minR;

    let maxR = minR;
    let residualHi = residualLo;

    for (let k = 0; k < MAXITERATIONS; k++) {
        maxR *= 2;
        residualHi = feedTrayDelta(maxR,feedRate,xFeed,xDistillate,xBottoms,pressure,feedTray,totalTrays,lightAntConsts,heavyAntConsts);
        if (!Number.isFinite(residualHi)) continue;
        if (Math.abs(residualHi) < TOL) return maxR;
        if (Math.sign(residualHi) !== Math.sign(residualLo)) break;
    }

    if (!Number.isFinite(residualHi) || Math.sign(residualHi) === Math.sign(residualLo)) {
        return -1;
    }
    let guessR = (minR + maxR) / 2;
    let error = 0;

    for (let i = 0; i < MAXITERATIONS; i++) {
        error = feedTrayDelta(guessR,feedRate,xFeed,xDistillate,xBottoms,pressure,feedTray,totalTrays,lightAntConsts,heavyAntConsts);
        if (Math.abs(error) < TOL) {
            console.log(`Number of iterations: ${i}. RR: ${guessR}`);
            return guessR;
        }
        if (error < 0 ) {
            maxR = guessR;
            guessR = (maxR + minR) / 2;
        } else {
            minR = guessR;
            guessR = (maxR + minR) / 2;
        }
    }
    console.log("Reached max iterations");
    return -1; // return -1 to show that it ran out of iterations
}

function feedTrayDelta(guessR,feedRate,xFeed,xDistillate,xBottoms,pressure,feedTray,totalTrays,lightAntConsts,heavyAntConsts) {
    const [distillateRate, bottomsRate] = productRates(feedRate,xFeed,xDistillate,xBottoms)
    const xRectifying = rectifyingSection(guessR,pressure,xDistillate,feedTray,lightAntConsts,heavyAntConsts);
    const boilUp = boilUpRatio(guessR,distillateRate,bottomsRate);
    const xStripping = strippingSection(boilUp,pressure,xBottoms,feedTray,totalTrays,lightAntConsts,heavyAntConsts);
    return xRectifying - xStripping;
}


/**
 * Determines the minimum reflux ratio to achieve product specifications. Used to check if the specified problem is feasible
 * @param {number} feedXp 
 * @param {number} distillateXp 
 * @param {number} pressure 
 * @param {object} lightAntConsts 
 * @param {object} heavyAntConsts 
 * @returns {number}
 */
function minimumRefluxRatio(feedXp, distillateXp, pressure, lightAntConsts, heavyAntConsts){
    const equilibriumYp = vapMolFraction(pressure,feedXp,lightAntConsts,heavyAntConsts);
    // solve for x
    const slope = (distillateXp - equilibriumYp) / (distillateXp - feedXp);
    return slope / (1 - slope); 
}

/**
 * Determines the minimum number of trays to achieve product specficiations. Used to check it the specified problem is feasible.
 * @param {number} distillateXp 
 * @param {number} bottomsXp 
 * @param {number} pressure 
 * @param {object} lightAntConsts 
 * @param {object} heavyAntConsts 
 * @returns {number}
 */
function minimumTrays(distillateXp, bottomsXp, pressure, lightAntConsts, heavyAntConsts) {
    const topTemp = equilibriumTemperatureFromX(pressure,distillateXp,lightAntConsts,heavyAntConsts);
    const alphaTop = vaporPressure(topTemp,lightAntConsts) / vaporPressure(topTemp, heavyAntConsts);
    const bottomTemp = equilibriumTemperatureFromX(pressure,bottomsXp,lightAntConsts,heavyAntConsts);
    const alphaBottom = vaporPressure(bottomTemp,lightAntConsts) / vaporPressure(bottomTemp, heavyAntConsts);
    const averageAlpha = Math.sqrt(alphaTop * alphaBottom);
    return (Math.log((distillateXp/(1 - distillateXp) * (1-bottomsXp) / bottomsXp)) / Math.log(averageAlpha));
}

/**
 * Data utility functions
 */

/**
 * helper function to create objects with tray information
 * @param {number} trayNumber 
 * @param {number} temperature 
 * @param {number} liqComp 
 * @param {number} vapComp 
 * @param {number} refluxRatio 
 * @param {number} boilUp 
 * @returns {object}
 */
function createTrayObject(trayNumber,temperature,liqComp,vapComp,refluxRatio,boilUp) {
    return {
        trayNumber,temperature,liqComp,vapComp, refluxRatio, boilUp
    }
}

/**
 * creates an array of the tray objects with correct information
 * @param {number} feedRate 
 * @param {number} xFeed 
 * @param {number} xDistillate 
 * @param {number} xBottoms 
 * @param {number} pressure 
 * @param {number} feedTray 
 * @param {number} totalTrays 
 * @param {number} refluxRatio 
 * @param {object} lightAntConsts 
 * @param {object} heavyAntConsts 
 * @returns {array[object]}
 */
function generateColumnData(feedRate,xFeed,xDistillate,xBottoms,pressure,feedTray,totalTrays,refluxRatio,lightAntConsts,heavyAntConsts){
    const [distillateRate, bottomsRate] = productRates(feedRate,xFeed,xDistillate,xBottoms);
    const boilUp = boilUpRatio(refluxRatio,distillateRate,bottomsRate);
    const trays = new Array(totalTrays + 1);
    let vapComp = 0;
    let liqComp = xDistillate;
    let temp = 0;
    // solve trays in rectifying section
    for (let i = 1; i <= feedTray; i++) {
        vapComp = rectifyingOperatingLine(refluxRatio,xDistillate,liqComp);
        liqComp = liqMolFraction(pressure,vapComp,lightAntConsts,heavyAntConsts);
        temp = equilibriumTemperatureFromX(pressure,liqComp,lightAntConsts,heavyAntConsts);
        trays[i-1] = createTrayObject(i,temp,liqComp,vapComp,refluxRatio,boilUp)
    }
    // solve trays in stripping section
    vapComp = xBottoms;
    for (let i = totalTrays + 1; i > feedTray; i--) {
        liqComp = strippingOperatingLine(boilUp,xBottoms,vapComp);
        vapComp = vapMolFraction(pressure,liqComp,lightAntConsts,heavyAntConsts);
        temp = equilibriumTemperatureFromX(pressure,liqComp,lightAntConsts,heavyAntConsts);
        trays[i-1] = createTrayObject(i,temp,liqComp,vapComp,refluxRatio,boilUp);
    }
    return trays;
}
// Conditional exports for Node.js testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        binaryequilibriumEquationFromX,
        binaryequilibriumEquationFromY,
        boilingPointTemperature,
        boilUpRatio,
        columnSolver,
        equilibriumTemperatureFromX,
        equilibriumTemperatureFromY,
        generateColumnData,
        liqMolFraction,
        minimumRefluxRatio,
        productRates,
        rectifyingOperatingLine,
        rectifyingSection,
        strippingOperatingLine,
        strippingSection,
        vapMolFraction,
        vaporPressure
    };
}