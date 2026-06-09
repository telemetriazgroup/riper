

#Control Manual 

No puede hacerse mientras haya un proceso activo 

Se




Logica de HOmogenizacion 

Tenemos : Temperatura Final , Humedad relativa y tiempo estimado 



LOgica de Maduracion 


SI se programa a un Set de etileno de 100 y la lectura actual es 0 , primero se realiza un test se inyecta 2 , y se espera el crecimiento de la lectura del sensor 

en caso de la cuenta de greenyard@riper.local , manetener la misma logica de control solo cambia el link para cada uno de los imei en ese caso no hay tunel solo la logica del imei en cada proceso . el link cambia a http://161.132.53.51:9051/TermoKing/comando_control/MEX3001?tipo=0&dato=18 , ten en cuenta esto para implemntacion del control por proceso y seguimiento para la cuenta greenyard@riper.local 

en todas la cuentas en el proceso de ripener o maduracion cuando se esta ne la validacion del co2 , sino no se consigue ajusatr el co2 en tres intentos , se procede a controlar el etileno que es nucleo del proceso 

en la cuenta de ultraorganics@riper.local , tenemos 5 imei asociados , pero solo se muestras 3 equipos dado a que tenemos 2 equipos con 2 maquinas (2 imei) , que son primer dispositivo con el imei MEX1001 y MEX1002 , segundo dispositivo con el imei MEX2001 Y MEX2001 y el tercer disposiitvo solo tiene un imei . entonces la logica de control de procesos y seguimiento debe aplicarse igual a esa cuenta cuando se activen procesos el link es  a http://161.132.53.51:9051/TermoKing/comando_control/MEX3001?tipo=0&dato=18  , para hacer los controles y el envio de comandos  , ojo el etileno se toma de MEX1001 , MEX2001 Y MEX3001  ya que son los que tienen los sensores , la humedad se obtiene de MEX1002,MEX2002 Y MEX3001 respectivamente para el estado de la flota


valida ne la cuenta de  ultraorganics@riper.local no esta apareciendo en estado de flota cunado se programa un proceso o un seguimiento y no se esta ejcutando el control de los procesoso validalo 


EN lo logica de inyeccion de etileno existe la posibilidad que el sensor de lecturas de cero , ejemplo a un setpoint de 50 ppm estemos inyectando 3 , 4 y las lecturas vayan de 12.1 , 21.5 y luego 30.5 , y luego se ponga en 0 , entonces el programa quiera inyectar 50 , esto es un error porque de forma momentanea el sistema detecto 0 el sensor y cunado vueleve a tomar lectura ahora la lectura es de 120.5 o mas debido a que se sobresaturo el sensor . evitar eso guardando los ultimos 5 datos diferentes de 0 y si inyectamos recientemente no es probabale que el valor 0 sea correcto a si que lo ignoramos y mantenemos la ultima lectura de 30.5 y no inyectamos hasta tener otro dato variable , seguimos consultando el nivel de etileno 

En la cuenta de gourmettrading@ztrack.app  , el dispositivo Túnel TUNEL_GREAT creado no permite editra el nombre y cunado guardamos un seguimiento no se guarda el seguimiento ni se muestra en el estado de flota que hay un seguimiento activo . y recordar que la unica cuenta que puede ver el valor real del etileno sin filtro en el estado de flota y en las graficas es superadmin@riper.local , las demas cuentas solo ven el etileno cuando tienen programado un proceso a un seguimiento que incluye "maduracion" entonces se les muestra un valor filtrado ejemplo si programaron etileno a 50 ppm , lo maximo que mostramos es el 21% es decir 10.5 mas osea 60.5 , asi el valor salga 200 o 160 se muestra 60.5 como maximo y datos menores . es muy importante para que el usuario no vea las variaciones bruscas d ela lectura . sino datos filtrados y estables 



Somos la empresa ZGROUP PERU y se requiere hacer un informe tecnico explicando el comportamiento del equipo ZGRU8721432 , DESDE EL DIA de mayo del 2026 hasta el dia 2 3 d ejunio dle 2026 . tenemos los datos cargados , ahora tenemos los datos cargados , en el analisis destacarar los dias 30 de mayo , 1 de junio y 2 de junio  . donde hay espacio de tiempos (de 14:00 1 de junio a 16 :00)dibujar una grafica de defrost , donde los datos inician en rango se elevan hasta 15 aprox . se hace explicar que el equipo estuvo en rango y que tenemos un evento de apagado el 2 d ejunio donde si se eleva la temperatura y demora en llegar a rango .  tener en cuenta Reception Date	es hoa del dato ,Set_point	es el nivel de temperatura programada ,Temp_supply_1  es la temperatura de suministro ,	Return_air es el sensor de retorno de tempeartura ,	Evaporation_coil  es el sensor de evaporador 


La grafica de etileno filtrados en las otras cuentas que no sean superadmin@riper.local  debe mostrarse con datos aproximados , en las ultimas 12 horas  . no se esta mostrando actualmente 

el super admin es superadmin@riper.local 

Tenemos 2 formas de mostar los datos una la que es el superusuario que observa los datos del etileno y humedad sin filtro .
y el otro que es el usuario normal  que ve los datos del etileno ajustado a los ppm objetivos que quiere lograra el cliente , este logica ya existe , lo que debemos hacer es recordar que hubo un proceso a un determinado ppm y ajustar los datos para el usuario , ya que actualmente cuando no hay proceso o seguimiento los datos del etileno no se muestran , y cunado no hay proceso activo solo mostrar valores de etileno por debajo de 40 .

En el caso de la humedad tenemos 2 perfiles para el super usuario sin filtro . para los usuarios normales ajustar los valores de humedad ejemplo de para valores de 0 a 50 ajustar a un rango de 50 a 70 con un decimal maximo  . para valores de 51 a 90 , ajustar de 71 a 90 , y los que son mayores a 90 si mostrar sin filtro . ejemplo si leemos 40 , vamos a mostrar un valor entre 50 y 70 de forma propocional .y asi sucesivamente .

Solo apra el superusuario las ultimas 12 horas se muestran sin filtro y el historico de datos sin filtro , pero tiene un checkbox para activar la vista " como lo mira el cliente"

El superusuario tiene acceso a la bitacora de todo los dispositivos por imei ,los usuarios normlaes pueden ver la bitacar pero no ven las lecrturas de eteileno solo muestran si se inyecta y si se consulta el valor de etileno pero no les muestra el  valor real , ejemplo 06/04/2026, 13:22	
Etileno	
Lectura etileno: 709.5 ppmMotivo: Lectura 709.5 ppm en monitoreo continuo. Objetivo 80 ppm.Avocado Peru 060426 XL Ripening . ESto puiede poner en alerta al cliente . debido a que ve que la lectura es de 709.5 , cuando nosotros lo estamos ajustando en las graficas para que se filtre . esto no debe mostrarse al usuario solo al superadmin 

En Seguimiento de proceso activo , se muetsran las acciones del etileno de esta forma Control automático en curso

Fase actual: Etileno (sensor UNIT333)

Última acción: Sin inyección de etileno — Lectura 91.4 ppm ya alcanza objetivo 80 ppm; no se inyecta.

Sincronizado: 06/04/2026, 13:30 , esto esta bien para el superusuario . pero para el usuario normla no deb mostrar Última acción: porque le muestra la lectura real del etileno 


En el control de etileno lo maximoa dosificar es 120 , sigue inyectando un proporcional , actualmente , se incrementa se forma indefinida . 


en el caso de la humedad empezar por 1 , ignorar el 0  ,para valores de 1 a 50 ajustar a un rango de 50 a 70 con un decimal maximo  . para valores de 51 a 90 , ajustar de 71 a 90 , y los que son mayores a 90 si mostrar sin filtro .


Implementar en cada dispositivo que este en linea , consulta del sensor de etileno , es decir en su respectivo link enviar un tipo 0 con dato 1 para consultar el estatus del etileno . si no hay comandos  enviados a su link en su bitacora ya mas de 10 minutos .  Entender tambien que se debe intentar setear temperatura , humedad y co2 maximo 3 veces sino se consigue setetar , pasa al siguinete , es decir si estoy si no consigo setear temperatura siga al siguiente control , de esta forma se evita que se quede estancado validando un cambio . 

LOgica de ventilacion 5 minutos antes de terminar enviar a su repestivo link el tipo 3 con dato del co2 objetivo que puede ser 0.5 



Realizar logica de STOP PLANT al momento de seleccionar en APAGAR , nos muestra una interfaz para programar STOP PLANT , el objetivo es enviar al link respectivo de tipo 10 y dato 7200 cada 1 horas . Controlar que las lecturas de las fases sean menores a 0.5 , si se detecta que por mas de 10 minutos siguen encima de 0.5 volver a enviar a el link respectivo tipo 10 dato 7200 , cunado este a 5 minutos de terminar el proceso de STOP PLANT enviar al link respectivo el tipo 10 con el dato de 300 . este flujo garantiza mantener el sistema suspendido , los camnpos a validar son consumption_ph_1 ,consumption_ph_2 ,consumption_ph_3 .