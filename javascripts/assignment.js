var connectedUser;
var webRTConnection;
var webRTChannel;
var dataReceivedWebRTC="";
var examImageComplete = false;
var examImageData="";
var streamImageData="";
var dataStudent="";
var student;
var pagesImage = {};
var lastInfo = {};
var flagDetection= false;
var flagSynchronizeWithServer= false;
var interval;
var socket = io.connect('',{'forceNew':true});

window.onload = function() {

  $('#startDetectionBtn').attr('disabled',true);
  $('#stopDetectionBtn').attr('disabled',true);
  $('#focusBtn').attr('disabled',true);
};

// Start the login process
send({type: "login",name: qrCode});

socket.on("login",function(data){
    data = JSON.parse(data);
    handleLogin(data.success);
});

socket.on("offer",function(data){
  data = JSON.parse(data);
  handleOffer(data.offer, data.name);
});

socket.on("answer",function(data){
  data = JSON.parse(data);
    handleAnswer(data.answer);
});

socket.on("candidate",function(data){
  data = JSON.parse(data);
  handleCandidate(data.candidate);
});

socket.on("leave",function(data){
  data = JSON.parse(data);
    handleLeave();
});

// Get a new instance of WebRTC
function getWebRTConnection(){

      var configuration = {
         "iceServers": [{
              'urls': 'stun:stun.l.google.com:19302'
            }
        ]
      };

      var webRTConnection = new RTCPeerConnection(configuration);

      // Setup ice handling
      webRTConnection.onicecandidate = function (event) {
         if (event.candidate) {
            send({
               type: "candidate",
               candidate: event.candidate
            });
         }
      };

      // Receive the data
      webRTConnection.ondatachannel = function(event) {
          var receiveChannel = event.channel;
          receiveChannel.onmessage = function(event) {
            var student_name = "";
            var student_id = "";
            // String para identificar que la data que se recibe son el examen y estudiante reconocido
            var dataExamRecognitionString = "initDataRecognition";
            // String para identificar que la data que se recibe son los frames de la camara
            var dataStreamImage = "initStream";

            // Se inicializa variable para saber que tipo de data se va a enviar
            if(event.data == dataExamRecognitionString) {
              dataReceivedWebRTC = dataExamRecognitionString;
              return;
            }

            else if(event.data == dataStreamImage) {
              dataReceivedWebRTC = dataStreamImage;
              return;
            }

            // Si la data esta relacionada con el reconocimiento
            if(dataReceivedWebRTC==dataExamRecognitionString){

              // Si se esta enviado la imagen del examen
              if(!examImageComplete){
                if (event.data == "\n") {
                    //console.log("Recibi "+examImageData.length);
                    //console.log(examImageData.length);
                    var imgbase4 = "data:image/png;base64,"+examImageData;
                    var img = $('.exam_image');
                    img.prop('src',imgbase4);
                    //examImageData =""
                    examImageComplete = true;
                  } else {
                    examImageData += event.data;
                    //trace("Data chunk received");
                  }
              }
              // Si se esta enviando la data del estudiante
              else{
                dataStudent = event.data;
                examImageComplete = false;
                student = JSON.parse(dataStudent);
                addPagesButtons(student.page);
                if(student.name === undefined){
                  $('#student_name_label').html("Student: ---- No encontrado ----");
                  $('#student_id_label').html("Id: ---- No encontrado ----");
                  student_name = '---- No encontrado ----';
                  student_id = '---- No encontrado ----';
                }
                else {
                  student_name = student.name;
                  student_id = student.Id;
                  $('#student_name_label').html("Student: "+student.name);
                  $('#student_id_label').html("Id: "+student.Id);
                  updatePageButton(student.matricula,student.page);
                  addImageStudent(student.matricula,student.page,examImageData);
                }

                updateLastInfo(student_name,student_id,student.page,examImageData);
                $('#student_predicted_label').html("Id predicted: "+student.predictedId);
                $('#student_page_label').html("Page: "+student.page);

                dataReceivedWebRTC = "";
                examImageData =""

                //console.log(pagesImage);
                //console.log("Student "+student.name+" "+student.Id+" "+student.predictedId+" "+student.page);
              }
            }

            // Si se envia el stream de la camara
            else if(dataReceivedWebRTC==dataStreamImage){
              if (event.data == "\n") {
                  var imgbase4 = "data:image/png;base64,"+streamImageData;
                  var img = $('.stream_image');
                  img.prop('src',imgbase4);
                  streamImageData ="";
                  dataReceivedWebRTC = "";
                } else {
                  streamImageData += event.data;
                  //trace("Data chunk received");
                }
            }
        }
      };

      webRTConnection.oniceconnectionstatechange = function(event){
        console.log(webRTConnection.iceConnectionState)
        // If the connecion is stablished
        if(webRTConnection.iceConnectionState=="connected"){
            $('#startDetectionBtn').attr('disabled',false);
            $('#focusBtn').attr('disabled',false);
            $('#qr_code').modal('close');
        }
      };

      return webRTConnection;
}

// Get a new instance of a webRT Channel
function getWebRTChannel(webRTConnection){

      var webRTChannel = webRTConnection.createDataChannel("channel1", {reliable:true});

      webRTChannel.onerror = function (error) {
          console.log("Ooops...error:", error);
          $('#startDetectionBtn').attr('disabled',true);
          $('#stopDetectionBtn').attr('disabled',true);
          $('#focusBtn').attr('disabled',true);
      };

      webRTChannel.onclose = function () {
        console.log("data channel is closed");
        $('#startDetectionBtn').attr('disabled',true);
        $('#stopDetectionBtn').attr('disabled',true);
        $('#focusBtn').attr('disabled',true);
      };

      return webRTChannel;
}

// Handle the loggin response
function handleLogin(success) {

   if (success === false) {
      alert("Ooops...try a different username");
   } else {
      //console.log("succes",qrCode);
      //Starting a peer connection
      webRTConnection = getWebRTConnection();
      webRTChannel = getWebRTChannel(webRTConnection);
    }

};

//when somebody sends us an offer
function handleOffer(offer, name) {
   connectedUser = name;
   console.log("handleOffer"+connectedUser);

   webRTConnection.setRemoteDescription(new RTCSessionDescription(offer));

   //create an answer to an offer
   webRTConnection.createAnswer(function (answer) {

      webRTConnection.setLocalDescription(answer);
      console.log("STUDENTS",studentsJSON);
      send({
         type: "answer",
         answer: answer,
         students:studentsJSON
      });

   }, function (error) {
     console.log(error);
      alert("Error when creating an answer");
   });
};

//when we got an ice candidate from a remote user
function handleCandidate(candidate) {
  console.log("handleCandidate ",candidate);
   webRTConnection.addIceCandidate(new RTCIceCandidate(candidate));
};

//when we got an answer from a remote user
function handleAnswer(answer) {
  console.log("handleAnswer",connectedUser);
  // EN este momemnto se lanza el evento onicecandidate
   webRTConnection.setRemoteDescription(new RTCSessionDescription(answer));
};

function handleLeave() {
   console.log("handleLeave");
   connectedUser = null;
   webRTConnection.close();
   webRTConnection.onicecandidate = null;
   webRTConnection = getWebRTConnection();
   webRTChannel = getWebRTChannel(webRTConnection);

   if(flagDetection)stopDetection(true);
};

function startDetection(syncronize){
    flagDetection = true;
    $('#startDetectionBtn').attr('disabled',true);
    $('#stopDetectionBtn').attr('disabled',false);
    $('#sendPDFBtn').attr('disabled',true);
    $('.pdfBtn').attr('disabled',true);
    send({
       type: "startDetection"
    });
    if(syncronize)
      interval = setInterval(synchronizeImagesWithServer, 60000*1);//1 minute
}

function stopDetection(syncronize){
    flagDetection = false;
    $('#startDetectionBtn').attr('disabled',false);
    $('#stopDetectionBtn').attr('disabled',true);
    $('#sendPDFBtn').attr('disabled',false);
    $('.pdfBtn').attr('disabled',false);
    send({
       type: "stopDetection"
    });
    if(syncronize){
      synchronizeImagesWithServer();
      clearInterval(interval);
    }
}

function focusEvent(){
    send({
       type: "focus"
    });
}

/* Agrega botones de páginas y los actualiza*/
function addPagesButtons(pageNumber){

  var div_paginas = $('span.pages');
  var diff = pageNumber - max_pages;
  max_pages = (diff > 0) ? pageNumber: max_pages ;
  if(diff > 0){
    for(var i = max_pages-diff+1 ; i <= max_pages; i++){
      var a = '<a id='+i+' target="_blank" class="waves-effect waves-light btn small-button white black-text">'+i+'</a> ';
      div_paginas.append(a);
      //console.log(pageDiv);
    }
  }
}

function updatePageButton(matricula,page){
  var divStudent = $('#mat'+matricula +' .pages '+'#'+page);
  var studentPdf = $('#pdf_'+matricula);
  divStudent.removeClass('white black-text').addClass('green white-text');
  studentPdf.removeClass('white black-text').addClass('blue white-text');
  //divStudent.attr( "href", "/getimg/"+exam_id+"/"+data.student.matricula+"_"+data.page);
}

function addImageStudent(matricula,page,imageBase64){
    if(!pagesImage[matricula])pagesImage[matricula]={};
    pagesImage[matricula][page]=examImageData;
    flagSynchronizeWithServer = true;
    //console.log(pagesImage);
}

function updateLastInfo(name,id,page,imageBase64){
    lastInfo["lastInfo"] = {student_name:name,student_id:id,page:page,image:imageBase64};
    flagSynchronizeWithServer = true;
    //console.log(lastInfo);
}

function synchronizeImagesWithServer(){
    // Si existen nuevas imagenes para sincronizar
    if(!flagSynchronizeWithServer)
        return;
    var initStopDetection = false;
    // Si la sincronizacion se da cuando se ha mandado a iniciar la deteccion
    if(flagDetection){
      stopDetection(false);
      initStopDetection = true;
    }

    for(var student in pagesImage){
        for(var page in pagesImage[student]){
            //for(var i = 0;i<30*1;i++){
              updateImagesServer(student,page,pagesImage[student][page]);
            // }

            //console.log(page);
        }

        delete pagesImage[student]
    }

    if(lastInfo.lastInfo){
        updateLastInfoServer(lastInfo.lastInfo.student_id,
                              lastInfo.lastInfo.student_name,
                              lastInfo.lastInfo.page,
                              lastInfo.lastInfo.image);
        delete lastInfo.lastInfo;
    }


    console.log("Sincronizando ",pagesImage);

    if(initStopDetection){
      startDetection(false);
    }
    flagSynchronizeWithServer = false;
}

// Send request to the severver to save images
function updateImagesServer(student_id,page,image){
    var postRequest = '/course/'+ course_id+'/assignment/'+exam_id+"/image";
    var data = {
        data:{student_id:student_id,page:page,image:image},
        type:'POST',
        dataType:'json'
    };

    $.ajax(postRequest,data)
      .done((data,status,xhr)=>{
          console.log(data);
      })
      .fail((data,status,xhr)=>{
          // Si la session ha caducado
          if(data.responseJSON==undefined)
            location.reload();
          console.log(data.responseJSON);
      });
}

function sendPDFs() {
  postSubmission(35199,201013430);
  postSubmission(2171,201206458);
}

function postSubmission(student_id_canvas,student_matricula) {
    var postRequest = '/course/'+ course_id+'/assignment/'+exam_id+"/submission";
    var data = {
        data:{student_id_canvas:student_id_canvas,student_id_matricula:student_matricula},
        type:'POST',
        dataType:'json'
    };
    $.ajax(postRequest,data)
      .done((data,status,xhr)=>{
          console.log(data);
      })
      .fail((data,status,xhr)=>{
          // Si la session ha caducado
          if(data.responseJSON==undefined)
            location.reload();
          console.log(data.responseJSON);
      });
}

// Send request to the severver to save images
function updateLastInfoServer(student_id,student_name,page,image){
    var postRequest = '/course/'+ course_id+'/assignment/'+exam_id+"/lastinfo";
    var data = {
        data:{student_id:student_id,student_name:student_name,page:page,image:image},
        type:'POST',
        dataType:'json'
    };

    $.ajax(postRequest,data)
      .done((data,status,xhr)=>{
          console.log(data);
      })
      .fail((data,status,xhr)=>{
          // Si la session ha caducado
          if(data.responseJSON==undefined)
            location.reload();
          console.log(data.responseJSON);
      });
}

// Send a socket IO message
function send(message) {
   //attach the other peer username to our messages
   if (connectedUser) {
      message.name = connectedUser;
   }

   socket.emit("message",JSON.stringify(message));
};


window.onunload = window.onbeforeunload = function(){
    synchronizeImagesWithServer();
};

setInterval(()=>{
      //location.reload();
      location.href = '/logout';
}, 60000*60);//1 hour
//setInterval(synchronizeImagesWithServer, 10000);
