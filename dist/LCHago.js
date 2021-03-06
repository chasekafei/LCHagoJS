var LCHago;
(function (LCHago) {
    var getQueryString = function (name) {
        var reg = new RegExp("(^|&)" + name + "=([^&]*)(&|$)", "i");
        var r = window.location.search.substr(1).match(reg);
        if (r != null)
            return decodeURIComponent(r[2]);
        return null;
    };
    LCHago.Config = {
        wsUrl: "ws://127.0.0.1:8888",
        pingSpace: 2,
        timeoutSpace: 5,
        closeSpace: 10,
        userData: new gameProto.UserData({
            uid: "uid",
            name: "name",
            avatar: "",
            opt: "",
        }),
        roomData: new gameProto.RoomData({
            roomID: "1",
            gameID: "gameID",
            channelID: "channelID",
            kv: "",
        })
    };
})(LCHago || (LCHago = {}));
var LCHago;
(function (LCHago) {
    LCHago.onWSConnect = function () {
        console.log("未监听onWSConnect", "正在加入房间");
    };
    LCHago.onWSTimeout = function () {
        console.log("未监听onWSClose", "连接关闭，重连超时，游戏已失败结算");
    };
    LCHago.onWSClose = function () {
        console.log("未监听onWSClose", "连接关闭，游戏结束");
    };
    LCHago.onWSDisconnect = function () {
        console.log("未监听onWSDisconnect", "正在尝试重连");
    };
    LCHago.onJoin = function (data) {
        console.log("未监听onJoin", data, "等待对手加入");
    };
    LCHago.onCreate = function (data) {
        console.log("未监听onCreate", data);
    };
    LCHago.onStart = function () {
        console.log("未监听onStart", "双方都完毕，可倒计时并开始游戏");
    };
    LCHago.onCustom = function (data) {
        console.log("未监听onCustom", data, "对方发送的消息");
    };
    LCHago.onEnd = function (data) {
        console.log("未监听onEnd", "游戏结算", "获胜玩家ID", data);
    };
    LCHago.onError = function (data) {
        console.log("未监听onError", "错误", data);
    };
})(LCHago || (LCHago = {}));
var LCHago;
(function (LCHago) {
    var msgPing = new gameProto.Msg();
    msgPing.ID = gameProto.MsgID.Ping;
    var pingBytes = gameProto.Msg.encode(msgPing).finish();
    var msgPong = new gameProto.Msg();
    msgPong.ID = gameProto.MsgID.Pong;
    var pongBytes = gameProto.Msg.encode(msgPing).finish();
    var WSServer = (function () {
        function WSServer() {
            this.isReconnect = false;
            this.isSendReady = false;
            this.isSendResult = false;
            this.hasRecvResult = false;
            this.pingDuration = 0;
            this.timeoutDuration = 0;
            this.sendIndex = 0;
            this.sendHistory = [];
            this.recvIndex = 0;
        }
        WSServer.prototype.connect = function () {
            if (this.ws) {
                return;
            }
            var ws = this.ws = new WebSocket(LCHago.Config.wsUrl);
            ws.onopen = this.onOpen.bind(this);
            ws.onmessage = this.onMessage.bind(this);
            ws.onclose = this.onClose.bind(this);
        };
        WSServer.prototype.onOpen = function () {
            var self = this;
            self.pingDuration = 0;
            self.timeoutDuration = 0;
            if (self.pingInterval == null) {
                self.pingInterval = setInterval(function () {
                    self.pingDuration += 0.5;
                    if (self.pingDuration >= LCHago.Config.pingSpace) {
                        self.pingDuration -= LCHago.Config.pingSpace;
                        self.ping();
                    }
                }, 500);
            }
            if (self.timeoutInterval == null) {
                self.timeoutInterval = setInterval(function () {
                    self.timeoutDuration += 0.5;
                    if (self.timeoutDuration >= LCHago.Config.timeoutSpace) {
                        console.log("timeout");
                        self.close();
                    }
                }, 500);
            }
            self.ws.binaryType = 'arraybuffer';
            if (this.joinID == null) {
                this.join();
            }
        };
        WSServer.prototype.onMessage = function (evt) {
            try {
                var uint8array = new Uint8Array(evt.data);
                var msg = gameProto.Msg.decode(uint8array);
                switch (msg.ID) {
                    case gameProto.MsgID.Ping:
                        this.pong();
                        break;
                    case gameProto.MsgID.JoinResp:
                        var msgJoinResp = gameProto.MsgJoinResp.decode(uint8array);
                        console.log("recv JoinResp", msgJoinResp);
                        this.joinID = msgJoinResp.joinID;
                        break;
                    case gameProto.MsgID.Create:
                        var msgCreate = gameProto.MsgCreate.decode(uint8array);
                        this.recvMsg(msgCreate.index);
                        LCHago.onCreate(msgCreate);
                        break;
                    case gameProto.MsgID.Start:
                        var msgStart = gameProto.MsgStart.decode(uint8array);
                        this.recvMsg(msgStart.index);
                        LCHago.onStart();
                        break;
                    case gameProto.MsgID.Custom:
                        var msgCustom = gameProto.MsgCustom.decode(uint8array);
                        LCHago.onCustom(msgCustom.data);
                        this.recvMsg(msgCustom.index);
                        break;
                    case gameProto.MsgID.Error:
                        var msgError = gameProto.MsgError.decode(uint8array);
                        LCHago.onError(msgError.msg);
                        break;
                    case gameProto.MsgID.End:
                        var msgEnd = gameProto.MsgEnd.decode(uint8array);
                        LCHago.onEnd(msgEnd.winnerPlayerID);
                        this.hasRecvResult = true;
                        break;
                }
            }
            catch (error) {
                console.log(error);
            }
            this.pingDuration = 0;
            this.timeoutDuration = 0;
        };
        WSServer.prototype.onClose = function () {
            this.ws = null;
            this.close();
        };
        WSServer.prototype.saveSend = function (bytes) {
            this.sendIndex += 1;
            this.sendHistory.push(bytes);
        };
        WSServer.prototype.recvMsg = function (index) {
            if (index == this.recvIndex) {
                console.log("recvMsg", index, "顺序正确");
                this.recvIndex += 1;
            }
            else {
                console.log("recvMsg", index, "顺序错误", this.recvIndex);
            }
        };
        WSServer.prototype.ping = function () {
            this.send(pingBytes);
        };
        WSServer.prototype.pong = function () {
            this.send(pongBytes);
        };
        WSServer.prototype.send = function (msg) {
            if (this.ws && this.ws.readyState == 1) {
                this.ws.send(msg);
            }
        };
        WSServer.prototype.close = function () {
            if (this.ws) {
                this.ws.close();
            }
            if (this.pingInterval) {
                clearInterval(this.pingInterval);
                this.pingInterval = null;
            }
            if (this.timeoutInterval) {
                clearInterval(this.timeoutInterval);
                this.timeoutInterval = null;
            }
            if (this.hasRecvResult) {
                LCHago.onWSClose();
            }
            else {
                LCHago.onWSTimeout();
            }
        };
        WSServer.prototype.join = function () {
            var msg = new gameProto.MsgJoin({
                ID: gameProto.MsgID.Join,
                userData: LCHago.Config.userData,
                roomData: LCHago.Config.roomData,
            });
            var msgBytes = gameProto.MsgJoin.encode(msg).finish();
            this.send(msgBytes);
            console.log("send Join", msg);
        };
        WSServer.prototype.sendReady = function () {
            if (!this.isSendReady) {
                this.isSendReady = true;
                var msg = new gameProto.MsgReady({
                    ID: gameProto.MsgID.Ready,
                    index: this.sendIndex
                });
                var msgBytes = gameProto.MsgReady.encode(msg).finish();
                this.saveSend(msgBytes);
                this.send(msgBytes);
                console.log("send Ready", "我方准备就绪");
            }
        };
        WSServer.prototype.sendCustom = function (data) {
            var msg = new gameProto.MsgCustom({
                ID: gameProto.MsgID.Custom,
                index: this.sendIndex,
                data: data
            });
            var msgBytes = gameProto.MsgCustom.encode(msg).finish();
            this.saveSend(msgBytes);
            this.send(msgBytes);
        };
        WSServer.prototype.sendResult = function (type) {
            if (!this.isSendResult) {
                this.isSendResult = true;
                var msg = new gameProto.MsgResult({
                    ID: gameProto.MsgID.Result,
                    index: this.sendIndex,
                    type: type
                });
                var msgBytes = gameProto.MsgResult.encode(msg).finish();
                this.saveSend(msgBytes);
                this.send(msgBytes);
            }
        };
        return WSServer;
    }());
    LCHago.WSServer = WSServer;
})(LCHago || (LCHago = {}));
var LCHago;
(function (LCHago) {
    var wsServer = new LCHago.WSServer();
    function Connect() {
        wsServer.connect();
    }
    LCHago.Connect = Connect;
    function Ready() {
        wsServer.sendReady();
    }
    LCHago.Ready = Ready;
    function Custom(data) {
        wsServer.sendCustom(data);
    }
    LCHago.Custom = Custom;
    function ResultNoStart() {
        wsServer.sendResult(0);
    }
    LCHago.ResultNoStart = ResultNoStart;
    function ResultWin() {
        wsServer.sendResult(1);
    }
    LCHago.ResultWin = ResultWin;
    function ResultLose() {
        wsServer.sendResult(2);
    }
    LCHago.ResultLose = ResultLose;
    function ResultDraw() {
        wsServer.sendResult(3);
    }
    LCHago.ResultDraw = ResultDraw;
})(LCHago || (LCHago = {}));
//# sourceMappingURL=LCHago.js.map