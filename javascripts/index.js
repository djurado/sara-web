function delete_assignment(curso,assignment){
  var deleteRequest = '/curso/'+ curso+'/assignment/'+assignment+"/delete";

  if(confirm('Desea eliminar todo lo referente a la tarea '+assignment)){
    show_loader(assignment,true);
    $.ajax(deleteRequest)
    .done((data,status,xhr)=>{
      console.log(data);
      show_loader(assignment,false);
      Materialize.toast('Archivos de la tarea eliminados correctamente', 2000) // 4000 is the duration of the toast
      //submitAssignment(url_response,user_id,loader);
    })
    .fail((data,status,xhr)=>{
      console.log(data);
      show_loader(assignment,false);
    });
  }
  }

function show_loader(assignment,show){
  var div = $("#"+assignment);
  if(show){
    div.css( "display", "inline-block" );
    div.css( "visibility", "visible" );
  }else{
    div.css( "display", "none" );
    div.css( "visibility", "hidden" );
  }
}
