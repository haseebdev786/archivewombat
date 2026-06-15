(function( $ ) {


    $(document).ready(
        function(){
            $("a.popup_trigger").unbind("click").bind("click",function(event){
                event.preventDefault();
                var target = $(this).attr('href');
                $.featherlight($(target));
            });
            $('.posts-blog-feed-module div.post-content h2.post-title').matchHeight({ property: 'min-height' });
            // let date_now = new Date();
            // let this_year = date_now.getFullYear();
            // let footer_content = $('#footer-info').html();
            // footer_content = footer_content.replace( '[year]', this_year );
            // $('#footer-info').html(footer_content);
        }
    )


})( jQuery );