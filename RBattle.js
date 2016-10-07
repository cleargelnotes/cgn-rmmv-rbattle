//=============================================================================
// RBattle.js
//=============================================================================

/*:
 * @plugindesc Custom Battle Engine
 * @author Ralph Pineda (cleargelnotes)
 *
 */
 
 (function(){
     // first of all, remove all Scene_Battle._partyCommandWindow references
     Scene_Battle.prototype.isAnyInputWindowActive = function() {
        return (this._actorCommandWindow.active ||
                this._skillWindow.active ||
                this._itemWindow.active ||
                this._actorWindow.active ||
                this._enemyWindow.active);
    };

    Scene_Battle.prototype.stop = function() {
        Scene_Base.prototype.stop.call(this);
        if (this.needsSlowFadeOut()) {
            this.startFadeOut(this.slowFadeSpeed(), false);
        } else {
            this.startFadeOut(this.fadeSpeed(), false);
        }
        this._statusWindow.close();
        this._actorCommandWindow.close();
    };

    Scene_Battle.prototype.updateStatusWindow = function() {
        if ($gameMessage.isBusy()) {
            this._statusWindow.close();
            this._actorCommandWindow.close();
        } else if (this.isActive() && !this._messageWindow.isClosing()) {
            this._statusWindow.open();
        }
    };

    Scene_Battle.prototype.updateWindowPositions = function() {
        var statusX = 0;
        if (BattleManager.isInputting()) {
            statusX = this._actorCommandWindow.width;
        } else {
            statusX = this._actorCommandWindow.width / 2;
        }
        if (this._statusWindow.x < statusX) {
            this._statusWindow.x += 16;
            if (this._statusWindow.x > statusX) {
                this._statusWindow.x = statusX;
            }
        }
        if (this._statusWindow.x > statusX) {
            this._statusWindow.x -= 16;
            if (this._statusWindow.x < statusX) {
                this._statusWindow.x = statusX;
            }
        }
    };

    Scene_Battle.prototype.createPartyCommandWindow = function() {
        
    };

    Scene_Battle.prototype.startPartyCommandSelection = function() {
        this.refreshStatus();
        this._statusWindow.deselect();
        this._statusWindow.open();
        this.selectNextCommand();
    };

    Scene_Battle.prototype.endCommandSelection = function() {
        this._actorCommandWindow.close();
        this._statusWindow.deselect();
    };

    Scene_Battle.prototype.startActorCommandSelection = function() {
        this._statusWindow.select(BattleManager.actor().index());
        this._actorCommandWindow.setup(BattleManager.actor());
    };

    ////////////// Next, add a "charge" system
    
    /////// Setup charge system functions
    Game_Unit.prototype.onCTBStart = function() {
        for (var i = 0; i < this.members().length; ++i) {
          var member = this.members()[i];
          if (member) member.onCTBStart();
        }
    };
    
    Game_Unit.prototype.setCTBV = function(v) {
        for (var i = 0; i < this.members().length; ++i) {
          var member = this.members()[i];
          if (member) member.setCTBV(v);
        }
    };
    
    Game_Battler.prototype.onCTBStart = function() {
        this._ctbv = 1000;
        this.calculateInitialCTBV();
        //this._ctbSpeed = eval(Yanfly.Param.CTBInitSpeed);
        //this._ctbSpeed += BattleManager.ctbTarget() * this.ctbStartRate();
        //this._ctbSpeed += this.ctbStartFlat();
        //this._ctbCharge = 0;
        //this._ctbCharging = false;
        //this._ctbChargeMod = 0;
        //this.applyPreemptiveBonusCTB();
        //this.applySurpriseBonusCTB();
        this.refresh();
    };
    
    Game_Battler.prototype.calculateInitialCTBV = function() {
        this._ctbv = 0;
        var agi = this.agi;
        agi = agi.clamp(1,999);
        
        var ictbv = 0;
        var v = 0;
        if (agi <= 250) {
            ictbv = 1000 - 2*agi;
            v = 10 + (agi/25.0);
        } else if (agi <= 500) {
            ictbv = 900 - (1.6*agi);
            v = 10 + (agi/25.0);
        } else {
            ictbv = 200 - (0.2*agi);
            v = 20 + (agi/50.0);
        }
        ictbv = ictbv + (Math.random() * v);
        ictbv = ictbv.clamp(1,9999);
        
        console.log("Calculated CTBV: " + String(ictbv));
        console.log("CTBPT: " + String(this.getCTBVPerTick()));
        this._ctbv = ictbv;
    };
    
    Game_Battler.prototype.getCTBVPerTick = function() {
        var ret = this.agi;
        return ret.clamp(25, 500);
    };
    
    Game_Battler.prototype.ctbTicksToReady = function() {
        var rate = this.getCTBVPerTick();
        return this._ctbv/rate;
    };
    
    Game_Battler.prototype.ctbTick = function(ticks) {
        this._ctbv = this._ctbv - this.getCTBVPerTick()*ticks;
        this._ctbv = this._ctbv.clamp(0,9999);
    };
    
    Game_Battler.prototype.setCTBV = function(v) {
        this._ctbv = v.clamp(0, 9999);
    };
    /////// End of Setup charge system functions
    
    var _BattleManager_startBattle = BattleManager.startBattle;
    BattleManager.startBattle = function() {
        _BattleManager_startBattle.call(this);
        this._phase = null;
        this._activeBattler = null;
        this.startCTB();
    };
    
    BattleManager.startCTB = function() {
        if (this._phase === 'battleEnd') return;
        this.clearCTBData();
        
        $gameParty.onCTBStart();
        $gameTroop.onCTBStart();
        
        if(this._surprise){
            $gameTroop.setCTBV(0);
        }
        
        this._phase = 'start';
    };
    
    BattleManager.clearCTBData = function() {
        this._ctbActorIndex = 0;
    };
    
    BattleManager.selectNextCommand = function() {
        do {
            if (!this.actor()){
                this.changeActor(this._ctbActorIndex, 'waiting');
            }else{
                if (!this.actor().selectNextCommand()) {
                    this.startTurn();
                    break;
                }
            }
        } while (!this.actor().canInput());
    };
    
    BattleManager.ctbTurnOrder = function() {
        var battlers = $gameParty.aliveMembers().concat($gameTroop.aliveMembers());
        battlers.sort(function(a, b) {
          if (a.ctbTicksToReady() > b.ctbTicksToReady()) return 1;
          if (a.ctbTicksToReady() < b.ctbTicksToReady()) return -1;
          if (a.agi > b.agi) return 1;
          if (a.agi < b.agi) return -1;
          return 0;
        });
        console.log(battlers);
        return battlers;
    };
    
    BattleManager.startInput = function() {
        this._phase = 'input';
        
        // first of all, get all battlers
        var battlers = this.ctbTurnOrder();
        
        $gameParty.clearActions();
        $gameTroop.clearActions();
        
        this._activeBattler = battlers[0];
        
        // adjust all battlers' ctbv
        var ticks = this._activeBattler.ctbTicksToReady();
        for(var i = 0; i < battlers.length; i++){
            battlers[i].ctbTick(ticks);
        }
        
        if(this._activeBattler.isEnemy()){
            this._activeBattler.makeActions();
            this.clearActor();
            this.startTurn();
        }else{
            this._activeBattler.makeActions();
            this._ctbActorIndex = $gameParty.battleMembers().indexOf(battlers[0]);
            this.clearActor();
            this.changeActor(this._ctbActorIndex, '');
        }
        
        //if (this._surprise || !$gameParty.canInput()) {
        //    this.startTurn();
        //}
    };
    
    BattleManager.updateTurnEnd = function() {
        if(this._activeBattler){
            this._activeBattler.setCTBV(1000);
        }
        this.startInput();
    };
}());
