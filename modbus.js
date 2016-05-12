/*
*************************************************************************************

							SCANASTUDIO 2 DECODER

The following commented block allows some related informations to be displayed online

<DESCRIPTION>

	

</DESCRIPTION>

<RELEASE_NOTES>

	 V1.0:  Initial release

</RELEASE_NOTES>

<AUTHOR_URL>

	mailto:n.bastit@ikalogic.com

</AUTHOR_URL>

<HELP_URL>



</HELP_URL>

*************************************************************************************
*/

/*
*************************************************************************************
								      INFO
*************************************************************************************
*/

/* The decoder name as it will apear to the users of this script 
*/
function get_dec_name()
{
	return "MODBUS";
}

/* The decoder version 
*/
function get_dec_ver()
{
	return "1.0";
}

/* Author 
*/
function get_dec_auth()
{
	return "Nicolas BASTIT";
}

/*
*************************************************************************************
							    GLOBAL VARIABLES
*************************************************************************************
*/
var channel_color;

/*
*************************************************************************************
								   DECODER
*************************************************************************************
*/

/* Graphical user interface for this decoder 
*/
function gui()  //graphical user interface
{
	ui_clear();  // clean up the User interface before drawing a new one.
	ui_add_ch_selector( "CH_SELECTOR", "Channel to decode:", "" );
	ui_add_baud_selector( "BAUD_SELECTOR", "BAUD rate:", 9600 );
	ui_add_txt_combo( "PARITY_SELECTOR", "Parity bit:" );
		ui_add_item_to_txt_combo( "No parity bit", true );
		ui_add_item_to_txt_combo( "Odd parity bit" );
		ui_add_item_to_txt_combo( "Even parity bit" );
	ui_add_separator();
	ui_add_txt_combo( "MODE_SELECTOR", "Mode:" );
		ui_add_item_to_txt_combo( "Modbus ASCII", true );
		ui_add_item_to_txt_combo( "Modbus RTU" );
}

function decode()
{
	get_ui_vals();                // Update the content of user interface variables
	clear_dec_items();            // Clears all the the decoder items and its content
	
	channel_color = get_ch_light_color(CH_SELECTOR);
	
	if(MODE_SELECTOR == 0)
		decode_ASCII();
	else
		decode_RTU();
}

function decode_RTU()
{
	var i;
	var state = 0;
	var t;
	var t_sample;
	var t_first;
  	var buffer;
  	var buffer_temp = new Array();
	var i_fct;
	var k;
	var val;
	var spb;
	var trame = [];
	var crc_red;
	var crc;
  	get_ui_vals();                // Update the content of user interface variables
  	clear_dec_items();            // Clears all the the decoder items and its content
	
	var stop_bit;
	if (PARITY_SELECTOR == 0)
		stop_bit=2;
	else
		stop_bit=0;
  
  	buffer = pre_decode("uart.js","ch = "+ CH_SELECTOR +"; baud = "+ BAUD_SELECTOR +"; nbits = 3; parity = "+ PARITY_SELECTOR +"; stop = "+ stop_bit +"; order = 0; invert = 0");
  
  	// Remove any element that do not contain data, e.g.: Start, Stop
  	for (i = 0; i < buffer.length; i++) 
	{ 
		if (buffer[i].data.length > 0)
    	{
      		buffer_temp.push(buffer[i]);
    	}
	}

  	buffer = buffer_temp;
    
	spb = sample_rate / BAUD_SELECTOR;
	t_first =  trs_get_first(CH_SELECTOR).sample;	

	for (i = 0; i < buffer.length; i++)
  	{
    	switch(state)
    	{
      	case 0: 
        	if (i < (buffer.length-1))
        	{
     			t=trs_go_before(CH_SELECTOR,buffer[i].start_s - spb);
				t_sample = t.sample;
				t = trs_get_prev(CH_SELECTOR);
				if( (t_first <= t_sample) && (t_sample - t.sample >= 28*spb) )
				{
					state = 1;
					trame = [];
					
					dec_item_new(CH_SELECTOR,buffer[i].start_s-12*spb,buffer[i].start_s-2*spb);
	              	dec_item_add_pre_text("Start of Frame "); //Maximum zoom
	              	dec_item_add_pre_text("Start frame ");
	              	dec_item_add_pre_text("SOF ");
	              	dec_item_add_pre_text("S ");//Minimum zoom
					
					pkt_start("Modbus RTU");
					pkt_add_item(buffer[i].start_s - 12*spb, buffer[i].start_s - 2*spb, "Start", "", dark_colors.blue, channel_color);
				}
				else
				{
					state = 0;
					pkt_end();
					break;
				}
        	}
			else
			{
				state = 0;
				pkt_end();
			}
      	case 1:
			if (i< buffer.length-1)
			{
				dec_item_new(CH_SELECTOR,buffer[i].start_s,buffer[i].end_s);
              	dec_item_add_pre_text("Address : "); //Maximum zoom
              	dec_item_add_pre_text("Addr : ");
              	dec_item_add_pre_text("Add ");
              	dec_item_add_pre_text("@ ");//Minimum zoom
				dec_item_add_data(buffer[i].data[0]);
				
				pkt_add_item(-1, -1, "Address", buffer[i].data[0], dark_colors.green, channel_color);
				
				trame[trame.length] = buffer[i].data[0];
				
				state = 2;
			}
			else
			{
        		state = 0;
				pkt_end();
			}
      		break;
		case 2:
			if (i< buffer.length-1)
			{
				dec_item_new(CH_SELECTOR,buffer[i].start_s,buffer[i].end_s);
              	dec_item_add_pre_text("Function : "); //Maximum zoom
              	dec_item_add_pre_text("Funct : ");
              	dec_item_add_pre_text("Fct ");
              	dec_item_add_pre_text("F ");//Minimum zoom
				dec_item_add_data(buffer[i].data[0]);
				
				i_fct = i;
				trame[trame.length] = buffer[i].data[0];
				
				pkt_add_item(-1, -1, "Function", buffer[i].data[0], light_colors.green, channel_color);
				
				state = 3;
			}
			else
			{
        		state = 0;
				pkt_end();
			}
      		break;
		case 3:
			if (i < buffer.length)
			{
				t=trs_go_after(CH_SELECTOR,buffer[i].end_s + spb);
				t_sample = t.sample;
				if( (t_sample - buffer[i].end_s >= 28*spb) || (!trs_is_not_last(CH_SELECTOR)) )
				{
					pkt_start("Data");
					for(k=i_fct+1;k<i-1;k++)
					{
						dec_item_new(CH_SELECTOR,buffer[k].start_s,buffer[k].end_s);
		              	dec_item_add_pre_text("Data : ");
						dec_item_add_data(buffer[k].data[0]);
						
						trame[trame.length] = buffer[k].data[0];
						
						pkt_add_item(-1, -1, "Data", buffer[k].data[0], light_colors.yellow, channel_color);
					}
					pkt_end();
				
					crc = crc_calculation(trame);
					
					crc_red = buffer[i-1].data[0]+ buffer[i].data[0]*0x100 ;
					dec_item_new(CH_SELECTOR,buffer[i-1].start_s,buffer[i].end_s);
	              	dec_item_add_pre_text("CRC "); //Maximum zoom
					dec_item_add_data(crc_red);
					
					if (crc==crc_red)
					{
						dec_item_add_post_text(" OK");
						pkt_add_item(-1, -1, "CRC OK", int_to_str_hex(crc_red), light_colors.orange, channel_color);
					}
					else
					{
	              		dec_item_add_post_text(" WRONG ! Should be " + int_to_str_hex(crc));
	              		dec_item_add_post_text(" ! " + int_to_str_hex(crc));
	              		dec_item_add_post_text("!");
						pkt_add_item(-1, -1, "CRC WRONG !", int_to_str_hex(crc_red), dark_colors.red, channel_color);
						pkt_start("CRC ERROR");
						pkt_add_item(-1,-1, "Should be :", int_to_str_hex(crc), dark_colors.orange, channel_color);
						pkt_end();
					}
				
					dec_item_new(CH_SELECTOR,buffer[i].end_s+spb,buffer[i].end_s+9*spb);
	              	dec_item_add_pre_text("End of Frame"); //Maximum zoom
	              	dec_item_add_pre_text("End Frame");
	              	dec_item_add_pre_text("EOF");
	              	dec_item_add_pre_text("E");
		
					pkt_add_item(-1,-1, "End of Frame", "", light_colors.blue, channel_color);
		
					state = 0;
					pkt_end();
				}
			}
			else
			{
				state = 0;
				pkt_end();
			}
			break;
		
    	}
  	}
}

function decode_ASCII()
{
	var i;
	var state = 0;
  	var buffer;
  	var buffer_temp = new Array();
	var i_fct;
	var k;
	var p=0;
	var lrc;
	var lrc_red;
	var val;
  	get_ui_vals();                // Update the content of user interface variables
  	clear_dec_items();            // Clears all the the decoder items and its content
	
	var stop_bit;
	if (PARITY_SELECTOR == 0)
		stop_bit=2;
	else
		stop_bit=0;
  
  	buffer = pre_decode("uart.js","ch = "+ CH_SELECTOR +"; baud = "+ BAUD_SELECTOR +"; nbits = 2; parity = "+ PARITY_SELECTOR +"; stop = "+ stop_bit +"; order = 0; invert = 0");
  
  	// Remove any element that do not contain data, e.g.: Start, Stop
  	for (i = 0; i < buffer.length; i++) 
	{ 
		if (buffer[i].data.length > 0)
    	{
      		buffer_temp.push(buffer[i]);
    	}
	}

  	buffer = buffer_temp;
    
	pkt_end();
  	for (i = 0; i < buffer.length; i++)
  	{
    	switch(state)
    	{
      	case 0: //Search for start of frame sequence (:)
			lrc = 0;
			p = 0;
			pkt_end();
        	if (i < (buffer.length-1))
        	{
          
          		if (buffer[i].data[0] == ":".charCodeAt(0)) 
          		{  
            		dec_item_new(CH_SELECTOR,buffer[i].start_s,buffer[i].end_s);
	              	dec_item_add_pre_text("Start of Frame "); //Maximum zoom
	              	dec_item_add_pre_text("Start frame ");
	              	dec_item_add_pre_text("SOF ");
	              	dec_item_add_pre_text("S ");//Minimum zoom
					dec_item_add_post_text(":");
					dec_item_add_post_text(":");
					dec_item_add_post_text(":");
					dec_item_add_post_text(":");
					dec_item_add_post_text(":");
	            	state = 1;
		
					pkt_start("Modbus ASCII");
					pkt_add_item(-1, -1, "Start", ":", dark_colors.blue, channel_color);
	         	}
        	}
      		break;
      	case 1:
			if (i< buffer.length-2)
			{
				if(buffer[i].data[0] < 58)
					val= (buffer[i].data[0] - 0x30)*16;
				else
					val= (buffer[i].data[0] - 55)*16;
				if(buffer[i+1].data[0] < 58)
					val+= buffer[i+1].data[0] - 0x30;
				else
					val+= buffer[i+1].data[0] - 55;
			
            	dec_item_new(CH_SELECTOR,buffer[i].start_s,buffer[i+1].end_s);
              	dec_item_add_pre_text("Address : "); //Maximum zoom
              	dec_item_add_pre_text("Addr : ");
              	dec_item_add_pre_text("Add ");
              	dec_item_add_pre_text("@ ");//Minimum zoom
				dec_item_add_data(val);
				
				pkt_add_item(-1, -1, "Address", val, dark_colors.green, channel_color);
				
				lrc += val;
					
            	state = 2;
				i++;
			}
			else
			{
        		state = 0; // Start fetching for start of frame again.
				pkt_end();
			}
      		break;
		case 2:
			if (i < buffer.length-2)
			{
				if(buffer[i].data[0] < 58)
					val= (buffer[i].data[0] - 0x30)*16;
				else
					val= (buffer[i].data[0] - 55)*16;
				if(buffer[i+1].data[0] < 58)
					val+= buffer[i+1].data[0] - 0x30;
				else
					val+= buffer[i+1].data[0] - 55;
					
				dec_item_new(CH_SELECTOR,buffer[i].start_s,buffer[i+1].end_s);
              	dec_item_add_pre_text("Function : "); //Maximum zoom
              	dec_item_add_pre_text("Funct : ");
              	dec_item_add_pre_text("Fct ");
              	dec_item_add_pre_text("F ");//Minimum zoom
				dec_item_add_data(val);
				
				lrc+= val;
					
				pkt_add_item(-1, -1, "Function", val, light_colors.green, channel_color);
				
            	state = 3;
				i++;
				i_fct = i;
			}
			else
			{
        		state = 0; // Start fetching for start of frame again.
				pkt_end();
			}
      		break;
		case 3:
			if (i < buffer.length-1)
			{
				if (  (buffer[i].data[0] == "\r\n".charCodeAt(0))
					&&(buffer[i+1].data[0] == "\r\n".charCodeAt(1)) )
				{
					pkt_start("Data");
					
					for(k=i_fct+1;k<i-2;k++)
					{
						p++;
						if(p%2 == 0)
						{
							if(buffer[k].data[0] < 58)
								val+= buffer[k].data[0] - 0x30;
							else
								val+= buffer[k].data[0] - 55;
								
							lrc += val;
							
							dec_item_new(CH_SELECTOR,buffer[k-1].start_s,buffer[k].end_s);
							dec_item_add_data(val);
							
							pkt_add_item(-1, -1, "Data", val, light_colors.yellow, channel_color);
						}
						else
						{
							if(buffer[k].data[0] < 58)
								val= (buffer[k].data[0] - 0x30)*16;
							else
								val= (buffer[k].data[0] - 55)*16;
						}
					}
					
					pkt_end();
					
					if (p%2)
					{
						dec_item_new(CH_SELECTOR,buffer[k].start_s,buffer[k+3].end_s);
						dec_item_add_pre_text("ERROR NUMBER OF BYTES");
						dec_item_add_pre_text("ERROR NBR BYTE");
						dec_item_add_pre_text("ERROR");
						dec_item_add_pre_text("E!");
						
						pkt_add_item(-1, -1, "ERROR", "#############", dark_colors.black, channel_color);
						
						state = 0;
						pkt_end();
						break;
					}
					
					lrc= (-lrc)%256;
					lrc = 256+lrc;
					
					if (i-2 > i_fct)
					{
						lrc_red = 0;
						
						if(buffer[i-2].data[0] < 58)
							lrc_red+= (buffer[i-2].data[0] - 0x30)*16;
						else
							lrc_red+= (buffer[i-2].data[0] - 55)*16;
						if(buffer[i-1].data[0] < 58)
							lrc_red+= buffer[i-1].data[0] - 0x30;
						else
							lrc_red+= buffer[i-1].data[0] - 55;
					
						
						dec_item_new(CH_SELECTOR,buffer[i-2].start_s,buffer[i-1].end_s);
				
		              	dec_item_add_pre_text("LRC ");
		              	dec_item_add_pre_text("LRC ");
						dec_item_add_data(lrc_red);
			
						if (lrc==lrc_red)
						{
							dec_item_add_post_text(" OK");
							pkt_add_item(-1, -1, "LRC OK", int_to_str_hex(lrc_red), light_colors.orange, channel_color);
						}
						else
						{
		              		dec_item_add_post_text(" WRONG ! Should be " + int_to_str_hex(lrc));
		              		dec_item_add_post_text(" ! " + int_to_str_hex(lrc));
		              		dec_item_add_post_text("!");
							pkt_add_item(-1, -1, "LRC WRONG !", int_to_str_hex(lrc_red), dark_colors.red, channel_color);
							pkt_start("LRC ERROR");
							pkt_add_item(-1,-1, "Should be :", int_to_str_hex(lrc), dark_colors.orange, channel_color);
							pkt_end();
						}
					}
					
					dec_item_new(CH_SELECTOR,buffer[i].start_s,buffer[i+1].end_s);
	              	dec_item_add_pre_text("End of Frame ");
	              	dec_item_add_pre_text("End frame ");
	              	dec_item_add_pre_text("EOF ");
	              	dec_item_add_pre_text("E ");
					dec_item_add_post_text("<CR><LF>");
					dec_item_add_post_text("<CR><LF>");
					
					pkt_add_item(-1, -1, "EOF", "<CR><LF>", light_colors.blue, channel_color);
		
					state = 0;
					pkt_end();
				}
			}
			else
			{
				state = 0;
				pkt_end();
			}
			break;
		
    	}
  	}
}

/*
*************************************************************************************
							     Signal Generator
*************************************************************************************
*/




/*
*************************************************************************************
							     DEMO BUILDER
*************************************************************************************
*/



/*
*************************************************************************************
							        UTILS
*************************************************************************************
*/
/*
*/
function int_to_str_hex (num) 
{
	var temp = "0x";

	if (num < 0x10)
	{
		temp += "0";
	}

	temp += num.toString(16).toUpperCase();

	return temp;
}


/*
*/
function get_ch_light_color (k)
{
    var chColor = get_ch_color(k);

    chColor.r = (chColor.r * 1 + 255 * 3) / 4;
	chColor.g = (chColor.g * 1 + 255 * 3) / 4;
	chColor.b = (chColor.b * 1 + 255 * 3) / 4;

	return chColor;
}

/*
*/
function crc_calculation(trame)
{
	var crc = 0xFFFF;
	var pos;
	var i;
 
  	for (pos = 0; pos < trame.length; pos++) 
	{
    	crc ^= trame[pos];       
 
    	for (i = 8; i != 0; i--) 
		{  
      		if ((crc & 0x0001) != 0) 
			{     
        		crc >>= 1;                   
        		crc ^= 0xA001;
      		}
      		else                          
        		crc >>= 1;
    	}
  	}
  	return crc;
}






