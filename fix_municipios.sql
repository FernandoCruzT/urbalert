UPDATE autoridad SET municipio = 'Zapopan'               WHERE municipio IN ('Norte') AND usuario_id IN (SELECT id FROM usuario WHERE email IN ('fernanda.toledo@urbalert.mx', 'maura.toledo@urbalert.mx'));
UPDATE autoridad SET municipio = 'Guadalajara'           WHERE municipio IN ('Centro') AND usuario_id IN (SELECT id FROM usuario WHERE email IN ('omar.cruz@urbalert.mx', 'daniel.cruz@urbalert.mx', 'carlos@urbalert.com', 'maria@urbalert.com', 'zoe642935@gmail.com'));
UPDATE autoridad SET municipio = 'San Pedro Tlaquepaque' WHERE municipio IN ('Sur') AND usuario_id IN (SELECT id FROM usuario WHERE email IN ('karolina.ramirez@urbalert.mx', 'correofalso2@gmail.com'));
UPDATE autoridad SET municipio = 'Tonala'                WHERE municipio IN ('Oriente') AND usuario_id IN (SELECT id FROM usuario WHERE email IN ('emilio.rico@urbalert.mx'));
UPDATE autoridad SET municipio = 'Zapopan'               WHERE municipio IN ('Poniente') AND usuario_id IN (SELECT id FROM usuario WHERE email IN ('christopher.morales@urbalert.mx'));

SELECT u.nombre, u.apellido, a.municipio FROM autoridad a JOIN usuario u ON u.id = a.usuario_id ORDER BY u.nombre;
